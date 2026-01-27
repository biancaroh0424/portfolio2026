/**
 * Vector store using chromadb SDK (local or Cloud). Used when CHROMA_API_KEY is not set.
 * When CHROMA_API_KEY is set, vector-store.ts uses vector-store-chroma-http instead (no chromadb in bundle).
 */

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
const CHROMA_DOC_MAX_BYTES = 12 * 1024

function chunkTextByBytes(text: string, maxBytes: number): string[] {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= maxBytes) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < buf.length) {
    let end = Math.min(start + maxBytes, buf.length)
    if (end < buf.length) {
      const slice = buf.subarray(start, end)
      const lastNewline = slice.lastIndexOf(10)
      const lastPeriod = slice.lastIndexOf(46)
      const best = lastNewline >= 0 ? lastNewline : (lastPeriod >= 0 ? lastPeriod : slice.length - 1)
      end = start + best + 1
    }
    chunks.push(buf.subarray(start, end).toString('utf8'))
    start = end
  }
  return chunks
}

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
    } catch {
      chromaAvailable = false
      return null
    }
  }
  return chromaClient
}

async function getOrCreateCollection(): Promise<Collection> {
  const client = getChromaClient()
  if (!client) throw new Error('ChromaDB client not available')
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { 'hnsw:space': 'cosine' },
  })
  return collection
}

let initPromise: Promise<void> | null = null

export function ensureVectorStoreInitialized(): void {
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT || !process.env.CHROMA_DATABASE) return
  if (initPromise) return
  initPromise = initializeVectorStore().catch((e) => {
    console.error('[Vector Store] Auto-init failed:', e)
    initPromise = null
  })
}

export async function initializeVectorStore(force?: boolean): Promise<void> {
  try {
    const client = getChromaClient()
    if (!client) return
    const collection = await getOrCreateCollection()
    const allContent = await getAllContent()
    const count = await collection.count()
    if (!force && count >= allContent.length) {
      collectionCache = collection
      return
    }
    if (count > 0) await collection.delete({ where: {} })
    const batchSize = 5
    let totalChunks = 0
    for (let i = 0; i < allContent.length; i += batchSize) {
      const batch = allContent.slice(i, i + batchSize)
      const ids: string[] = []
      const embeddings: number[][] = []
      const metadatas: Record<string, unknown>[] = []
      const documents: string[] = []
      for (const content of batch) {
        try {
          const textToEmbed = `${content.title}\n${Array.isArray(content.content) ? content.content.join(' ') : content.content}`
          const chunks = chunkTextByBytes(textToEmbed, CHROMA_DOC_MAX_BYTES)
          for (let c = 0; c < chunks.length; c++) {
            const chunkId = chunks.length === 1 ? content.id : `${content.id}-c${c}`
            ids.push(chunkId)
            embeddings.push(await generateEmbedding(chunks[c]))
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
      if (ids.length > 0) await collection.add({ ids, embeddings, metadatas, documents })
    }
    collectionCache = collection
  } catch (error) {
    console.error('[Vector Store] Init Error:', error)
  }
}

export async function searchVectorStore(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: SearchFilter
): Promise<SearchResult[]> {
  try {
    let collection = collectionCache
    if (!collection) {
      collection = await getOrCreateCollection()
      collectionCache = collection
    }
    const conditions: Array<Record<string, string>> = []
    if (filter?.projectId) conditions.push({ projectId: filter.projectId })
    if (filter?.language) conditions.push({ language: filter.language })
    const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : { $and: conditions }
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: Math.min(limit + 1, 20),
      where,
    })
    if (!results.ids?.length) return []
    const ids = results.ids[0]
    const distances = results.distances?.[0] || []
    const metadatas = results.metadatas?.[0] || []
    const documents = results.documents?.[0] || []
    const searchResults: SearchResult[] = []
    for (let i = 0; i < ids.length; i++) {
      const similarity = 1 - (distances[i] ?? 0)
      if (similarity < 0.25) continue
      const meta = (metadatas[i] ?? {}) as Record<string, unknown>
      const docLanguage = meta.language as 'en' | 'ko' | 'it' | undefined
      const docType = (meta.type as string) || 'project'
      if (filter?.language && docType !== 'resume' && ids[i] !== 'resume') {
        if (!docLanguage || docLanguage !== filter.language) continue
      }
      searchResults.push({
        id: ids[i],
        score: similarity,
        content: {
          id: ids[i],
          title: (meta.title as string) || '',
          content: (documents[i] as string) || '',
          projectId: meta.projectId as string | undefined,
          language: docLanguage,
          type: docType as 'project' | 'about' | 'general' | 'resume',
        },
      })
    }
    return searchResults.sort((a, b) => b.score - a.score).slice(0, limit)
  } catch (error) {
    chromaAvailable = false
    const { searchVectorStore: searchOpt } = await import('./vector-store-optimized')
    return searchOpt(queryEmbedding, limit, filter)
  }
}

export async function listVectorStoreDocuments(): Promise<Array<{ id: string; content: { title: string } }>> {
  try {
    if (!getChromaClient()) return []
    const collection = await getOrCreateCollection()
    const result = await collection.peek({ limit: 500 })
    const ids = result.ids ?? []
    const metadatas = result.metadatas ?? []
    return ids.map((id, i) => ({
      id: String(id),
      content: { title: (metadatas[i] as Record<string, unknown>)?.title as string ?? '' },
    }))
  } catch {
    return []
  }
}
