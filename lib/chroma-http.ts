/**
 * Chroma Cloud REST API client (fetch-only, no chromadb/onnx).
 * Used in serverless (Vercel) to avoid 250MB bundle from onnx/transformers.
 */

const CHROMA_BASE = 'https://api.trychroma.com'

function base(tenant: string, database: string) {
  return `${CHROMA_BASE}/api/v2/tenants/${tenant}/databases/${database}`
}

async function chromaFetch(
  apiKey: string,
  url: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<Response> {
  return fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      'x-chroma-token': apiKey,
      'Content-Type': 'application/json',
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  })
}

/** Get or create collection by name; returns collection id. */
export async function getOrCreateCollectionId(
  apiKey: string,
  tenant: string,
  database: string,
  name: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const url = `${base(tenant, database)}/collections`
  const res = await chromaFetch(apiKey, url, {
    method: 'POST',
    body: { name, get_or_create: true, metadata: metadata ?? { 'hnsw:space': 'cosine' } },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma getOrCreateCollection failed: ${res.status} ${t}`)
  }
  const col = (await res.json()) as { id: string }
  return col.id
}

/** Query by embedding. */
export async function chromaQuery(
  apiKey: string,
  tenant: string,
  database: string,
  collectionId: string,
  queryEmbeddings: number[][],
  nResults: number,
  where?: unknown
): Promise<{
  ids: string[][]
  distances?: (number | null)[][]
  metadatas?: (Record<string, unknown> | null)[][]
  documents?: (string | null)[][]
}> {
  const url = `${base(tenant, database)}/collections/${collectionId}/query`
  const res = await chromaFetch(apiKey, url, {
    method: 'POST',
    body: { query_embeddings: queryEmbeddings, n_results: nResults, where },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma query failed: ${res.status} ${t}`)
  }
  return res.json()
}

/** Add records. */
export async function chromaAdd(
  apiKey: string,
  tenant: string,
  database: string,
  collectionId: string,
  payload: { ids: string[]; embeddings: number[][]; metadatas?: Record<string, unknown>[]; documents?: string[] }
): Promise<void> {
  const url = `${base(tenant, database)}/collections/${collectionId}/add`
  const res = await chromaFetch(apiKey, url, { method: 'POST', body: payload })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma add failed: ${res.status} ${t}`)
  }
}

/** Count records. */
export async function chromaCount(
  apiKey: string,
  tenant: string,
  database: string,
  collectionId: string
): Promise<number> {
  const url = `${base(tenant, database)}/collections/${collectionId}/count`
  const res = await chromaFetch(apiKey, url, { method: 'GET' })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma count failed: ${res.status} ${t}`)
  }
  const data = (await res.json()) as number
  return data
}

/** Get (peek) records. */
export async function chromaGet(
  apiKey: string,
  tenant: string,
  database: string,
  collectionId: string,
  limit: number
): Promise<{ ids: string[]; metadatas?: (Record<string, unknown> | null)[] }> {
  const url = `${base(tenant, database)}/collections/${collectionId}/get`
  const res = await chromaFetch(apiKey, url, { method: 'POST', body: { limit } })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma get failed: ${res.status} ${t}`)
  }
  const data = (await res.json()) as { ids?: string[]; metadatas?: (Record<string, unknown> | null)[] }
  return { ids: data.ids ?? [], metadatas: data.metadatas }
}

/** Delete records by ids and/or where. Chroma Cloud rejects empty where {}; use ids to delete all. */
export async function chromaDelete(
  apiKey: string,
  tenant: string,
  database: string,
  collectionId: string,
  opts: { ids?: string[]; where?: unknown }
): Promise<void> {
  const url = `${base(tenant, database)}/collections/${collectionId}/delete`
  const body: { ids?: string[]; where?: unknown } = {}
  if (opts.ids != null && opts.ids.length > 0) body.ids = opts.ids
  if (opts.where != null && typeof opts.where === 'object' && Object.keys(opts.where as object).length > 0) body.where = opts.where
  if (Object.keys(body).length === 0) return
  const res = await chromaFetch(apiKey, url, { method: 'POST', body })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chroma delete failed: ${res.status} ${t}`)
  }
}
