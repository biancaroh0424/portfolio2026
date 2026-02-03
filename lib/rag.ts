import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateEmbedding } from './embeddings'
import { searchVectorStore } from './vector-store'
import { Content } from './data'

export interface SearchResult {
  content: Content
  score: number
}

const logAI = (msg: string, extra?: Record<string, unknown>) => {
  const t = new Date().toISOString().slice(11, 23)
  if (extra) console.log(`[AI] ${t} ${msg}`, extra)
  else console.log(`[AI] ${t} ${msg}`)
}

const EMBED_QUERY_MAX_LEN = 400 // 긴 문장은 잘라서 임베딩 — 속도·캐시·품질

/**
 * 벡터 검색으로 관련 콘텐츠 찾기 (임베딩 캐시 + 벡터스토어 정적 로드로 지연 최소화)
 */
export async function searchRelevantContent(
  query: string,
  limit: number = 7,
  projectId?: string,
  language?: 'en' | 'ko' | 'it'
): Promise<SearchResult[]> {
  try {
    // 임베딩 입력 길이 상한 — 드래그된 긴 텍스트가 들어와도 짧게 잘라서 빠르게
    const q = (query && query.trim()) ? query.trim().slice(0, EMBED_QUERY_MAX_LEN) : ''
    if (!q) return []
    logAI('벡터검색: 임베딩 요청')
    const queryEmbedding = await generateEmbedding(q)
    const filter = projectId 
      ? { projectId, language } 
      : language 
        ? { language } 
        : undefined
    logAI('벡터검색: 스토어 쿼리')
    const results = await searchVectorStore(queryEmbedding, limit, filter)
    logAI('벡터검색 완료', { results: results.length })
    
    if (results.length === 0) {
      return []
    }
    
    // 언어 필터링 (추가 안전장치 - 엄격하게 적용)
    let filteredResults = results
    if (language) {
      filteredResults = results.filter(result => {
        // resume 타입은 언어 필터 무시
        if (result.content.type === 'resume') {
          return true
        }
        // 프로젝트나 다른 타입은 언어가 반드시 일치해야 함
        if (!result.content.language || result.content.language !== language) {
          return false
        }
        return true
      })
    }
    
    // SearchResult 형식으로 변환 (content.type은 'project'|'about'|'general'|'resume')
    return filteredResults.map(result => ({
      content: result.content,
      score: result.score
    })) as SearchResult[]
  } catch (error) {
    console.error('[RAG] Error searching:', error)
    return []
  }
}

/** 키워드 기반 폴백 (LLM 실패/타임아웃 시 사용) */
function isProjectRelatedByKeywords(query: string): boolean {
  const projectKeywords = [
    '프로젝트', 'project', '작업', '디자인', 'design', 'ux', 'ui',
    'veluga', '벨루가', 'rag', 'chat', 'dashboard', 'analytics',
    'lg display', 'inspector', 'appearance', '챗봇', '빌더',
    'onboarding', 'activation', '사용자', 'user', '인터페이스',
    '노영주', '영주', '소개', '알려', '어떤', '무엇', '누구', '사람',
    '대표', '성과', '임팩트', 'impact', '비즈니스', 'business'
  ]
  const queryLower = query.toLowerCase()
  return projectKeywords.some(keyword => queryLower.includes(keyword))
}

const PROJECT_RELATED_PROMPT = `Does this user message ask about the portfolio (projects, design work, case studies, the person/creator, company, results, or anything that might be in the portfolio)? Answer only YES or NO.`

/**
 * 프로젝트 관련 질문인지 LLM이 판단 (키워드 폴백 포함)
 */
export async function isProjectRelated(query: string): Promise<boolean> {
  const q = (query && query.trim()) ? query.trim().slice(0, 500) : ''
  if (!q) return false

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return isProjectRelatedByKeywords(q)

    const genAI = new GoogleGenerativeAI(apiKey)
    // 빠른 분류용 (미지원 시 gemini-1.5-flash 등으로 변경 가능)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 4, temperature: 0 }
    })
    const result = await model.generateContent(`${PROJECT_RELATED_PROMPT}\n\nUser: ${q}\nAnswer:`)
    const text = result.response.text()?.trim().toLowerCase() ?? ''
    const yes = text.includes('yes') || text.includes('예') || text.includes('네')
    logAI('프로젝트 관련 LLM 판단', { query: q.slice(0, 40), yes })
    return yes
  } catch (e) {
    logAI('프로젝트 관련 LLM 실패, 키워드 폴백', { err: e instanceof Error ? e.message : String(e) })
    return isProjectRelatedByKeywords(q)
  }
}
