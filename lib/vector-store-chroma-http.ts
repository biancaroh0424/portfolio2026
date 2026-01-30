/**
 * Vector store implementation using Chroma Cloud REST API only (no chromadb SDK).
 * Used when CHROMA_API_KEY is set so serverless bundle stays under 250MB.
 */

import { generateEmbedding } from './embeddings'
import { getAllContent, Content } from './data'
import * as chroma from './chroma-http'

export interface VectorDocument {
  id: string
  content: Content
  embedding: number[]
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
      const best = lastNewline >= 0 ? lastNewline : lastPeriod >= 0 ? lastPeriod : slice.length - 1
      end = start + best + 1
    }
    chunks.push(buf.subarray(start, end).toString('utf8'))
    start = end
  }
  return chunks
}

function getConfig() {
  const apiKey = process.env.CHROMA_API_KEY
  const tenant = process.env.CHROMA_TENANT
  const database = process.env.CHROMA_DATABASE
  if (!apiKey || !tenant || !database) return null
  return { apiKey, tenant, database }
}

let collectionIdCache: string | null = null

async function getOrCreateCollectionId(): Promise<string> {
  if (collectionIdCache) return collectionIdCache
  const cfg = getConfig()
  if (!cfg) throw new Error('Chroma Cloud not configured')
  collectionIdCache = await chroma.getOrCreateCollectionId(
    cfg.apiKey,
    cfg.tenant,
    cfg.database,
    COLLECTION_NAME,
    { 'hnsw:space': 'cosine' }
  )
  return collectionIdCache
}

let initPromise: Promise<void> | null = null

export function ensureVectorStoreInitialized(): void {
  const cfg = getConfig()
  if (!cfg) return
  if (initPromise) return
  initPromise = initializeVectorStore().catch((e) => {
    console.error('[Vector Store] Auto-init failed:', e)
    initPromise = null
  })
}

export async function initializeVectorStore(force?: boolean): Promise<void> {
  const cfg = getConfig()
  if (!cfg) {
    console.warn('[Vector Store] Chroma Cloud not configured. Skipping init.')
    return
  }
  try {
    console.log('[Vector Store] Checking initialization status...', force ? '(force refresh)' : '')
    const cid = await getOrCreateCollectionId()
    const allContent = await getAllContent()
    if (allContent.length === 0) {
      console.warn('[Vector Store] getAllContent() returned 0 items. Check loadProjectsData (Blob/API) and projects.json in Blob.')
    }
    const count = await chroma.chromaCount(cfg.apiKey, cfg.tenant, cfg.database, cid)

    if (!force && count >= allContent.length) {
      console.log(`[Vector Store] Already initialized (${count} chunks). Skipping...`)
      return
    }
    if (force) console.log('[Vector Store] Force refresh: clearing and re-initializing.')

    console.log('[Vector Store] Initializing / Updating Vector Store...')
    if (count > 0) {
      await chroma.chromaDelete(cfg.apiKey, cfg.tenant, cfg.database, cid, {})
    }

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
            const emb = await generateEmbedding(chunks[c])
            ids.push(chunkId)
            embeddings.push(emb)
            metadatas.push({
              title: content.title || '',
              ...(content.projectId && { projectId: content.projectId }),
              language: content.language ?? 'en',
              type: content.type || 'project',
              ...(content.anchor != null && content.anchor !== '' && { anchor: content.anchor }),
              ...(content.headingIndex != null && { headingIndex: content.headingIndex }),
            })
            documents.push(chunks[c])
          }
          totalChunks += chunks.length
        } catch (e) {
          console.error(`Error embedding ${content.id}:`, e)
        }
      }
      if (ids.length > 0) {
        await chroma.chromaAdd(cfg.apiKey, cfg.tenant, cfg.database, cid, {
          ids,
          embeddings,
          metadatas,
          documents,
        })
      }
    }
    console.log(`[Vector Store] Initialization complete. Chunks: ${totalChunks} (from ${allContent.length} contents)`)
  } catch (error) {
    console.error('[Vector Store] Init Error:', error)
  }
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

export async function searchVectorStore(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: SearchFilter
): Promise<SearchResult[]> {
  const cfg = getConfig()
  if (!cfg) {
    const { searchVectorStore: searchOpt } = await import('./vector-store-optimized')
    return searchOpt(queryEmbedding, limit, filter)
  }
  try {
    const cid = await getOrCreateCollectionId()
    const conditions: Array<Record<string, string>> = []
    if (filter?.projectId) conditions.push({ projectId: filter.projectId })
    if (filter?.language) conditions.push({ language: filter.language })
    const where =
      conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : { $and: conditions }

    const raw = await chroma.chromaQuery(
      cfg.apiKey,
      cfg.tenant,
      cfg.database,
      cid,
      [queryEmbedding],
      Math.min(limit + 1, 20),
      where
    )
    if (!raw.ids?.length) return []

    const ids = raw.ids[0] ?? []
    const distances = raw.distances?.[0] ?? []
    const metadatas = raw.metadatas?.[0] ?? []
    const documents = raw.documents?.[0] ?? []

    const results: SearchResult[] = []
    for (let i = 0; i < ids.length; i++) {
      const similarity = 1 - (distances[i] ?? 0)
      if (similarity < 0.25) continue
      const meta = (metadatas[i] ?? {}) as Record<string, unknown>
      const docLanguage = meta.language as 'en' | 'ko' | 'it' | undefined
      const docType = (meta.type as string) || 'project'
      if (filter?.language && docType !== 'resume' && ids[i] !== 'resume') {
        if (!docLanguage || docLanguage !== filter.language) continue
      }
      results.push({
        id: ids[i],
        score: similarity,
        content: {
          id: ids[i],
          title: (meta.title as string) || '',
          content: (documents[i] as string) || '',
          projectId: meta.projectId as string | undefined,
          language: docLanguage,
          type: docType as 'project' | 'about' | 'general' | 'resume',
          anchor: meta.anchor as string | undefined,
          headingIndex: meta.headingIndex as number | undefined,
        },
      })
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit)
  } catch (error) {
    console.warn('[Vector Store] Chroma HTTP search failed, falling back to JSON store.', error)
    const { searchVectorStore: searchOpt } = await import('./vector-store-optimized')
    return searchOpt(queryEmbedding, limit, filter)
  }
}

export async function listVectorStoreDocuments(): Promise<Array<{ id: string; content: { title: string } }>> {
  const cfg = getConfig()
  if (!cfg) return []
  try {
    const cid = await getOrCreateCollectionId()
    const { ids, metadatas } = await chroma.chromaGet(cfg.apiKey, cfg.tenant, cfg.database, cid, 500)
    return (ids ?? []).map((id, i) => ({
      id: String(id),
      content: { title: ((metadatas ?? [])[i] as Record<string, unknown>)?.title as string ?? '' },
    }))
  } catch {
    return []
  }
}
