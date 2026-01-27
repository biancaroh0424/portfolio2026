/**
 * Vector store router: CHROMA_API_KEY 있으면 chroma-http(fetch만), 없으면 chromadb SDK.
 * 동적 import로 서버리스 시 chromadb/onnx 번들 제외.
 */
export type { VectorDocument } from './vector-store-chroma-http'

type Impl = typeof import('./vector-store-chroma-http')
let implCache: Impl | null = null

async function getImpl(): Promise<Impl> {
  if (implCache) return implCache
  implCache =
    process.env.CHROMA_API_KEY && process.env.CHROMA_TENANT && process.env.CHROMA_DATABASE
      ? await import('./vector-store-chroma-http')
      : await import('./vector-store-sdk')
  return implCache
}

export function ensureVectorStoreInitialized(): void {
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT || !process.env.CHROMA_DATABASE) return
  getImpl().then((m) => m.ensureVectorStoreInitialized()).catch((e) => console.error('[Vector Store] ensureVectorStoreInitialized failed:', e))
}

export async function initializeVectorStore(force?: boolean): Promise<void> {
  const m = await getImpl()
  return m.initializeVectorStore(force)
}

export async function searchVectorStore(
  queryEmbedding: number[],
  limit?: number,
  filter?: { projectId?: string; language?: 'en' | 'ko' | 'it' }
): Promise<Array<{ id: string; content: { id: string; title: string; content: string; projectId?: string; language?: 'en' | 'ko' | 'it'; type: 'project' | 'about' | 'general' | 'resume' }; score: number }>> {
  const m = await getImpl()
  return m.searchVectorStore(queryEmbedding, limit, filter)
}

export async function listVectorStoreDocuments(): Promise<Array<{ id: string; content: { title: string } }>> {
  const m = await getImpl()
  return m.listVectorStoreDocuments()
}
