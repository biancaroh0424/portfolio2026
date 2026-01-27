import { generateEmbedding } from './embeddings'
import { getAllContent, Content } from './data'
import { ChromaClient, CloudClient, Collection } from 'chromadb'

export interface VectorDocument {
  id: string
  content: Content
  embedding: number[]
}

interface SearchFilter {
  projectId?: string
  language?: 'en' | 'ko' | 'it'
}

interface SearchResult {
  id: string
  content: Content
  score: number
}

const COLLECTION_NAME = 'portfolio_content'

// Chroma Cloud 문서 크기 제한 (16KB). 안전 마진으로 12KB 단위로 청크
const CHROMA_DOC_MAX_BYTES = 12 * 1024

function chunkTextByBytes(text: string, maxBytes: number): string[] {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= maxBytes) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < buf.length) {
    let end = Math.min(start + maxBytes, buf.length)
    // 경계를 문장/줄 경계로 맞추기 (가능하면)
    if (end < buf.length) {
      const slice = buf.subarray(start, end)
      const lastNewline = slice.lastIndexOf(10) // \n
      const lastPeriod = slice.lastIndexOf(46) // .
      const best = lastNewline >= 0 ? lastNewline : (lastPeriod >= 0 ? lastPeriod : slice.length - 1)
      end = start + best + 1
    }
    chunks.push(buf.subarray(start, end).toString('utf8'))
    start = end
  }
  return chunks
}

// Chroma Cloud: CHROMA_API_KEY + CHROMA_TENANT + CHROMA_DATABASE 설정 시 CloudClient 사용.
// 미설정 시 로컬 서버( CHROMA_HOST:CHROMA_PORT ) 시도 → 실패 시 JSON 폴백.
let chromaClient: ChromaClient | null = null
let chromaAvailable: boolean | null = null
let collectionCache: Collection | null = null

function getChromaClient(): ChromaClient | null {
  if (chromaAvailable === false) return null

  if (!chromaClient) {
    try {
      const apiKey = process.env.CHROMA_API_KEY
      const tenant = process.env.CHROMA_TENANT
      const database = process.env.CHROMA_DATABASE

      if (apiKey && tenant && database) {
        chromaClient = new CloudClient({ apiKey, tenant, database })
      } else {
        const host = process.env.CHROMA_HOST ?? 'localhost'
        const port = Number(process.env.CHROMA_PORT ?? '8000')
        chromaClient = new ChromaClient({ host, port })
      }
    } catch (error) {
      chromaAvailable = false
      return null
    }
  }
  return chromaClient
}

async function getOrCreateCollection() {
  const client = getChromaClient()
  if (!client) throw new Error('ChromaDB client not available')
  
  try {
    const collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { "hnsw:space": "cosine" } // 코사인 유사도 명시
    })
    return collection
  } catch (error) {
    chromaAvailable = false
    throw error
  }
}

// Chroma Cloud 사용 시, 첫 채팅/검색 전에 백그라운드로 한 번만 초기화 스케줄
let initPromise: Promise<void> | null = null

/**
 * Chroma Cloud(env 설정)일 때 벡터 저장소를 백그라운드로 한 번만 초기화합니다.
 * 채팅 API 등에서 검색 전에 호출하면, 별도 버튼 없이도 Cloud가 자동으로 채워집니다.
 */
export function ensureVectorStoreInitialized(): void {
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT || !process.env.CHROMA_DATABASE) return
  if (initPromise) return
  initPromise = initializeVectorStore().catch((e) => {
    console.error('[Vector Store] Auto-init failed:', e)
    initPromise = null
  })
}

/**
 * 벡터 저장소 초기화.
 * @param force true이면 "이미 있음" 체크 없이 전부 지우고 다시 채움. Admin 저장 시 사용.
 */
export async function initializeVectorStore(force?: boolean): Promise<void> {
  try {
    console.log('[Vector Store] Checking initialization status...', force ? '(force refresh)' : '')
    
    // ChromaDB 사용 불가면 바로 종료 (JSON 모드로 넘어감)
    const client = getChromaClient()
    if (!client) {
      console.warn('[Vector Store] ChromaDB not found. Skipping init.')
      return
    }

    const collection = await getOrCreateCollection()
    const allContent = await getAllContent()
    const count = await collection.count()

    if (!force) {
      // 청크 개수 >= 콘텐츠 개수면 이미 채워진 것으로 간주 (채팅 시 자동 init 스킵용)
      if (count >= allContent.length) {
        console.log(`[Vector Store] Already initialized (${count} chunks). Skipping...`)
        collectionCache = collection
        return
      }
    } else {
      console.log('[Vector Store] Force refresh: clearing and re-initializing.')
    }

    console.log('[Vector Store] Initializing / Updating Vector Store...')
    if (count > 0) {
      await collection.delete({ where: {} })
    }

    // 배치 처리: 콘텐츠별로 12KB 이하 청크로 잘라 Chroma Cloud 문서 크기 제한(16KB) 준수
    const batchSize = 5
    let totalChunks = 0

    for (let i = 0; i < allContent.length; i += batchSize) {
      const batch = allContent.slice(i, i + batchSize)
      console.log(`[Vector Store] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allContent.length / batchSize)}`)
      
      const ids: string[] = []
      const embeddings: number[][] = []
      const metadatas: any[] = []
      const documents: string[] = []

      for (const content of batch) {
        try {
          const textToEmbed = `${content.title}\n${Array.isArray(content.content) ? content.content.join(' ') : content.content}`
          const chunks = chunkTextByBytes(textToEmbed, CHROMA_DOC_MAX_BYTES)

          for (let c = 0; c < chunks.length; c++) {
            const chunkId = chunks.length === 1 ? content.id : `${content.id}-c${c}`
            const embedding = await generateEmbedding(chunks[c])
            ids.push(chunkId)
            embeddings.push(embedding)
            metadatas.push({
              title: content.title || '',
              ...(content.projectId && { projectId: content.projectId }),
              ...(content.language && { language: content.language }),
              type: content.type || 'project',
            })
            documents.push(chunks[c])
          }
          totalChunks += chunks.length
        } catch (e) {
          console.error(`Error embedding ${content.id}:`, e)
        }
      }

      if (ids.length > 0) {
        await collection.add({ ids, embeddings, metadatas, documents })
      }
    }

    console.log(`[Vector Store] Initialization complete. Chunks: ${totalChunks} (from ${allContent.length} contents)`)
    collectionCache = collection

  } catch (error) {
    console.error('[Vector Store] Init Error:', error)
    // 실패해도 에러 던지지 않음 -> JSON 폴백 사용 유도
  }
}

/**
 * 벡터 검색
 */
export async function searchVectorStore(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: SearchFilter
): Promise<SearchResult[]> {
  try {
    let collection = collectionCache
    if (!collection) {
      collection = await getOrCreateCollection()
      collectionCache = collection // 다음 검색부터 재사용
    }
    
    // 필터 구성 — Chroma where는 "필드 하나당 하나"만 허용. 둘 이상이면 $and 사용
    const conditions: Array<Record<string, string>> = []
    if (filter?.projectId) conditions.push({ projectId: filter.projectId })
    if (filter?.language) conditions.push({ language: filter.language })
    const where =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : { $and: conditions }

    // 검색 (필요한 만큼만 요청 — nResults 초과 시 연산 낭비)
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: Math.min(limit + 1, 20), // 언어 필터 등으로 부족할 수 있어 +1, 상한 20
      where
    })

    if (!results.ids || results.ids.length === 0) return []

    const searchResults: SearchResult[] = []
    const ids = results.ids[0]
    const distances = results.distances?.[0] || []
    const metadatas = results.metadatas?.[0] || []
    const documents = results.documents?.[0] || []

    for (let i = 0; i < ids.length; i++) {
      const similarity = 1 - (distances[i] || 0) // 거리 -> 유사도 변환
      if (similarity < 0.25) continue // 유사도 너무 낮으면 버림

      const meta = metadatas[i] || {}
      const docLanguage = (meta.language as 'en'|'ko'|'it') || undefined
      const docType = (meta.type as any) || 'project'
      
      // 언어 필터 추가 검증 (ChromaDB where 필터가 제대로 작동하지 않을 수 있음)
      if (filter?.language) {
        // resume 타입은 언어 필터 무시
        if (docType !== 'resume' && ids[i] !== 'resume') {
          // 프로젝트나 다른 타입은 언어가 반드시 일치해야 함
          if (!docLanguage || docLanguage !== filter.language) {
            continue // 이 문서는 스킵
          }
        }
      }
      
      searchResults.push({
        id: ids[i],
        score: similarity,
        content: {
          id: ids[i],
          title: (meta.title as string) || '',
          content: documents[i] || '',
          projectId: (meta.projectId as string) || undefined,
          language: docLanguage,
          type: docType
        }
      })
    }

    return searchResults.sort((a, b) => b.score - a.score).slice(0, limit)

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[Vector Store] Chroma search failed, falling back to JSON store.', { error: errMsg })
    chromaAvailable = false
    const { searchVectorStore: searchOptimized } = await import('./vector-store-optimized')
    return searchOptimized(queryEmbedding, limit, filter)
  }
}

/** 벡터 저장소에 저장된 문서 목록 반환 (embed GET 등 상태 확인용) */
export async function listVectorStoreDocuments(): Promise<Array<{ id: string; content: { title: string } }>> {
  try {
    const client = getChromaClient()
    if (!client) return []
    const collection = await getOrCreateCollection()
    const result = await collection.peek({ limit: 500 })
    const ids = result.ids ?? []
    const metadatas = result.metadatas ?? []
    return ids.map((id, i) => ({
      id: String(id),
      content: { title: (metadatas[i]?.title as string) ?? '' }
    }))
  } catch {
    return []
  }
}
