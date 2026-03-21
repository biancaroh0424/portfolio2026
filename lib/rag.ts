import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateEmbedding } from './embeddings'
import { searchVectorStore } from './vector-store'
import { Content, getAllContent } from './data'

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
  const runDevCmsFallback = async (): Promise<SearchResult[]> => {
    try {
      const q = (query || '').trim().toLowerCase()
      if (!q) return []

      // 임베딩 없이 대충이라도 "관련성 있는" 청크를 뽑기 위한 키워드 토큰
      const terms = q
        .split(/\s+/g)
        .map((t) => t.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter((t) => t.length >= 2)
        .slice(0, 30)

      if (terms.length === 0) return []

      const all = await getAllContent()

      const candidates = all
        .filter((c) => {
          if (projectId) {
            if (!c.projectId || c.projectId !== projectId) return false
          }
          if (language) {
            if (c.type === 'resume') return true
            if (!c.language || c.language !== language) return false
          }
          return true
        })
        .map((c) => {
          const haystack = `${c.title}\n${c.content}`.toLowerCase()
          let hits = 0
          for (const term of terms) {
            if (term && haystack.includes(term)) hits += 1
          }
          return { content: c, score: hits }
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return candidates.map((x) => ({ content: x.content, score: x.score }))
    } catch (fallbackError) {
      console.error('[RAG] dev fallback failed:', fallbackError)
      return []
    }
  }

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
      if (process.env.NODE_ENV === 'development') {
        return await runDevCmsFallback()
      }
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

    if (process.env.NODE_ENV === 'development' && filteredResults.length === 0) {
      return await runDevCmsFallback()
    }
    
    // SearchResult 형식으로 변환 (content.type은 'project'|'about'|'general'|'resume')
    return filteredResults.map(result => ({
      content: result.content,
      score: result.score
    })) as SearchResult[]
  } catch (error) {
    console.error('[RAG] Error searching:', error)
    // dev에서만: 임베딩/벡터검색이 실패해도 챗봇이 답할 수 있게
    // CMS contents를 직접 컨텍스트로 사용 (프로덕션/스테이징은 Chroma 유지).
    if (process.env.NODE_ENV !== 'development') return []
    return await runDevCmsFallback()
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
