/**
 * Vector store router:
 * - VECTOR_STORE_MODE=file → 로컬 data/embeddings.json (Chroma 불필요)
 * - 로컬 next dev + Chroma Cloud 미설정 → 자동 file (localhost Chroma 미기동 시 CORS/연결 오류 방지)
 * - CHROMA_API_KEY+TENANT+DATABASE → Chroma Cloud HTTP
 * - 그 외 → chromadb SDK (로컬 서버 또는 CloudClient)
 */
export type { VectorDocument } from './vector-store-chroma-http'

type Impl = typeof import('./vector-store-chroma-http')
let implCache: Impl | null = null

function shouldUseFileVectorStore(): boolean {
  const mode = process.env.VECTOR_STORE_MODE?.toLowerCase()
  if (mode === 'file') return true
  if (mode === 'chroma') return false

  const onVercel = process.env.VERCEL === '1'
  const isLocalDev = process.env.NODE_ENV === 'development' && !onVercel
  if (!isLocalDev) return false

  const hasChromaCloud = !!(
    process.env.CHROMA_API_KEY &&
    process.env.CHROMA_TENANT &&
    process.env.CHROMA_DATABASE
  )
  // 로컬에서 Chroma Cloud 키가 없으면 파일 스토어 (미리보기). 로컬 Chroma 쓰려면 CHROMA_USE_LOCAL_SERVER=1
  if (hasChromaCloud) return false
  if (process.env.CHROMA_USE_LOCAL_SERVER === '1') return false
  return true
}

async function getImpl(): Promise<Impl> {
  if (implCache) return implCache
  if (shouldUseFileVectorStore()) {
    implCache = (await import('./vector-store-file')) as unknown as Impl
    return implCache
  }
  implCache =
    process.env.CHROMA_API_KEY && process.env.CHROMA_TENANT && process.env.CHROMA_DATABASE
      ? await import('./vector-store-chroma-http')
      : await import('./vector-store-sdk')
  return implCache
}

export function ensureVectorStoreInitialized(): void {
  if (shouldUseFileVectorStore()) return
  if (!process.env.CHROMA_API_KEY || !process.env.CHROMA_TENANT || !process.env.CHROMA_DATABASE) return
  getImpl().then((m) => m.ensureVectorStoreInitialized()).catch((e) => console.error('[Vector Store] ensureVectorStoreInitialized failed:', e))
}

export type { VectorStoreInitResult } from './vector-store-chroma-http'

export async function initializeVectorStore(force?: boolean): Promise<import('./vector-store-chroma-http').VectorStoreInitResult> {
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
