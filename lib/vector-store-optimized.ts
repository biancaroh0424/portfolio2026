import { generateEmbedding } from './embeddings'
import { getAllContent, Content } from './data'
import { cosineSimilarity } from './embeddings' // embeddings.ts에 이 함수 있다고 가정
import fs from 'fs/promises'
import path from 'path'

export interface VectorDocument {
  id: string
  content: Content
  embedding: number[]
}

// 캐시 변수
let memoryCache: VectorDocument[] | null = null
const JSON_PATH = path.join(process.cwd(), 'data', 'embeddings.json')

// 로드 (메모리 캐싱 사용)
export async function loadVectorStore(): Promise<VectorDocument[]> {
  if (memoryCache) return memoryCache
  
  try {
    const fileContent = await fs.readFile(JSON_PATH, 'utf-8')
    memoryCache = JSON.parse(fileContent)
    return memoryCache || []
  } catch (e) {
    return [] // 파일 없으면 빈 배열
  }
}

// 검색 (단순화된 코사인 유사도)
export async function searchVectorStore(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: { projectId?: string; language?: string }
) {
  const docs = await loadVectorStore()
  if (docs.length === 0) return []

  const candidates = docs
    .filter(doc => {
      // 필터링: 프로젝트ID나 언어가 다르면 제외
      if (filter?.projectId && doc.content.projectId && doc.content.projectId !== filter.projectId) return false
      
      // 언어 필터: resume 타입이 아니면 언어가 반드시 일치해야 함
      if (filter?.language) {
        // resume 타입은 언어 필터 무시
        if (doc.content.type === 'resume' || doc.id === 'resume') {
          // resume은 통과
        } else {
          // 프로젝트나 다른 타입은 언어가 반드시 일치해야 함
          if (!doc.content.language || doc.content.language !== filter.language) {
            return false
          }
        }
      }
      return true
    })
    .map(doc => ({
      id: doc.id,
      content: doc.content,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .filter(res => res.score > 0.25) // 유사도 컷
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return candidates
}
