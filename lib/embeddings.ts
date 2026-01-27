import { GoogleGenerativeAI } from '@google/generative-ai'

const EMBEDDING_CACHE_MAX = 80
const embeddingCache = new Map<string, number[]>() // key = normalized query, value = embedding

function normalizeQueryForCache(q: string): string {
  return q.trim().replace(/\s+/g, ' ')
}

// Gemini API 초기화 (클라이언트 재사용)
let _genAI: GoogleGenerativeAI | null = null
function getGeminiClient(): GoogleGenerativeAI {
  if (_genAI) return _genAI
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
  _genAI = new GoogleGenerativeAI(apiKey)
  return _genAI
}

// 텍스트를 벡터 임베딩으로 변환 (캐시 없음, 내부용)
async function generateEmbeddingUncached(text: string): Promise<number[]> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
  // SDK accepts string | EmbedContentRequest — 문자열 전달 시 내부 포맷팅
  const result = await model.embedContent(text)
  if (!result.embedding?.values) throw new Error('Failed to generate embedding')
  return result.embedding.values
}

const logAI = (msg: string, extra?: Record<string, unknown>) => {
  const t = new Date().toISOString().slice(11, 23)
  if (extra) console.log(`[AI] ${t} ${msg}`, extra)
  else console.log(`[AI] ${t} ${msg}`)
}

// 쿼리용 임베딩 — 캐시 사용 (동일/정규화 동일 쿼리면 API 호출 스킵)
export async function generateEmbedding(text: string): Promise<number[]> {
  const key = normalizeQueryForCache(text)
  if (!key) return generateEmbeddingUncached(text)
  const cached = embeddingCache.get(key)
  if (cached) {
    logAI('임베딩 캐시 히트')
    return cached
  }
  logAI('임베딩 캐시 미스, API 호출')
  const embedding = await generateEmbeddingUncached(text)
  logAI('임베딩 API 완료')
  embeddingCache.set(key, embedding)
  if (embeddingCache.size > EMBEDDING_CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value
    if (oldest != null) embeddingCache.delete(oldest)
  }
  return embedding
}

// 여러 텍스트를 한 번에 임베딩 (순차적으로 처리)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  
  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text)
      embeddings.push(embedding)
      // API rate limit 방지를 위한 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 50)) // 100ms -> 50ms로 감소
    } catch (error) {
      embeddings.push([]) // 빈 배열로 처리
    }
  }
  
  return embeddings
}

// 코사인 유사도 계산 (최적화: 빠른 계산)
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0 // 에러 대신 0 반환 (성능 최우선)
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  // 루프 언롤링으로 약간의 성능 향상
  const len = vecA.length
  for (let i = 0; i < len; i++) {
    const a = vecA[i]
    const b = vecB[i]
    dotProduct += a * b
    normA += a * a
    normB += b * b
  }
  
  if (normA === 0 || normB === 0) {
    return 0
  }
  
  // Math.sqrt 한 번만 계산
  const sqrtNormA = Math.sqrt(normA)
  const sqrtNormB = Math.sqrt(normB)
  return dotProduct / (sqrtNormA * sqrtNormB)
}

