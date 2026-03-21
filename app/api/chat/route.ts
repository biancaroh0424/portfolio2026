import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { list } from '@vercel/blob'
import {
  searchRelevantContent,
  isProjectRelated
} from '@/lib/rag'
import { ensureVectorStoreInitialized } from '@/lib/vector-store'
import { generateAIResponseStream } from '@/lib/rag-stream'
import { getProjects, getProject } from '@/lib/data'
import { getProjectOnPageForChat } from '@/lib/project-chat-meta'
import { detectLanguage, getCountryFromIP, getGreeting, type SupportedLanguage } from '@/lib/language'

export const runtime = 'nodejs'

const RESUME_FILE = path.join(process.cwd(), 'data', 'resume.json')
const BLOB_RESUME_PATH = 'data/resume.json'

function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

/** 이력서 PDF가 실제로 있는 언어만 반환. 프로덕션은 Blob의 resume.json 기준 */
async function getAvailableResumeLangs(): Promise<string[]> {
  const langs = ['en', 'ko', 'it'] as const
  try {
    if (isBlobStorageEnabled()) {
      const { blobs } = await list({ prefix: 'data/', limit: 20 })
      const pathnameOf = (b: { pathname?: string; name?: string }) => (b.pathname ?? b.name ?? '') as string
      const blob =
        blobs.find((b) => pathnameOf(b) === BLOB_RESUME_PATH) ??
        blobs.find((b) => pathnameOf(b)?.endsWith?.('resume.json')) ??
        blobs.find((b) => pathnameOf(b)?.includes?.('resume.json'))
      if (!blob?.url) return []
      const url = String(blob.url) + (String(blob.url).includes('?') ? '&' : '?') + '_=' + Date.now()
      const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!res.ok) return []
      const resume = (await res.json()) as Record<string, string>
      return langs.filter((lang) => resume[lang]?.trim())
    }
    const data = await fs.readFile(RESUME_FILE, 'utf-8')
    const resume = JSON.parse(data) as Record<string, string>
    return langs.filter((lang) => resume[lang]?.trim())
  } catch {
    return []
  }
}

const logAI = (msg: string, extra?: Record<string, unknown>) => {
  const t = new Date().toISOString().slice(11, 23)
  if (extra) console.log(`[AI] ${t} ${msg}`, extra)
  else console.log(`[AI] ${t} ${msg}`)
}

export async function POST(request: NextRequest) {
  const t0 = Date.now()
  logAI('요청 수신')
  try {
    const { message, conversationHistory, currentPath, currentHash, pageLanguage, pendingOpen } = await request.json()
    logAI('파싱 완료', {
      msgLen: message?.length,
      path: currentPath,
      elapsed: `${Date.now() - t0}ms`
    })

    // Chroma Cloud 사용 시 백그라운드에서 한 번만 초기화 (사용자 별도 동작 불필요)
    ensureVectorStoreInitialized()

    // Selected Context chip 텍스트 추출
    const selectedContextMatch = message.match(/\[Selected Context:\s*([^\]]+)\]/)
    const selectedContext = selectedContextMatch ? selectedContextMatch[1].trim() : null
    const actualMessage = selectedContext 
      ? message.replace(/\[Selected Context:[^\]]+\]/, '').trim()
      : message
    
    // IP 기반 국가 감지
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || request.ip || null
    
    // 간단한 국가 코드 추출 (실제로는 GeoIP 서비스 사용 권장)
    // 여기서는 Accept-Language 헤더 사용
    const acceptLanguage = request.headers.get('accept-language') || ''
    let countryCode: string | null = null
    if (acceptLanguage.includes('ko') || acceptLanguage.includes('KR')) {
      countryCode = 'KR'
    } else if (acceptLanguage.includes('it') || acceptLanguage.includes('IT')) {
      countryCode = 'IT'
    } else if (acceptLanguage.includes('en') || acceptLanguage.includes('US') || acceptLanguage.includes('GB')) {
      countryCode = 'US'
    }
    
    // 언어 감지: 사용자가 질문한 언어를 우선 사용 (페이지 언어 무시)
    // AI 답변 언어 = 사용자가 질문한 언어
    const pageLang = pageLanguage && ['en', 'ko', 'it'].includes(pageLanguage) ? pageLanguage : null
    const detectedLanguage = detectLanguage(actualMessage) || pageLang || 'en' // 메시지 언어 우선, 없으면 페이지 언어, 그것도 없으면 영어
    const greeting = getGreeting(countryCode, detectedLanguage)
    
    logAI('언어 감지', {
      detectedLanguage,
      elapsed: `${Date.now() - t0}ms`
    })
    
    // 프로젝트 리스트를 가져올 때는 페이지 언어를 사용 (사용자 메시지 언어가 아님)
    const projectListLanguage: 'en' | 'ko' | 'it' = (pageLang || detectedLanguage) as 'en' | 'ko' | 'it'
    
    // 현재 경로에서 projectId 추출 (예: /portfolio/rag-chat-builder -> rag-chat-builder)
    const projectIdMatch = currentPath?.match(/\/portfolio\/([^\/]+)/)
    const projectId = projectIdMatch ? projectIdMatch[1] : undefined
    const isProjectListPage = currentPath === '/portfolio' // 포트폴리오 리스트 페이지인지 확인
    
    // 벡터 검색용 쿼리는 짧게 유지 — 드래그+질문 시 임베딩이 길어져서 느려지는 문제 제거
    // 선택 텍스트는 LLM(messageWithContext)에만 넣고, 검색에는 질문만 또는 선택 앞 250자만 사용
    const searchQuery = actualMessage.trim()
      ? actualMessage.trim().slice(0, 380)
      : (selectedContext ? selectedContext.slice(0, 250).trim() : '').slice(0, 380)
    
    // 개인 정보 관련 질문인지 확인 (노영주, 경력, 학력, 소개 등)
    const personalInfoKeywords = [
      '노영주', '영주', '소개', '경력', '학력', 'education', 'experience', 
      '스킬', 'skill', '누구', '어떤 사람', '어떤 분', '어떤 디자이너',
      '배경', 'background', '약력', '이력', 'resume', '이력서'
    ]
    const messageLower = actualMessage.toLowerCase()
    const isPersonalInfoQuery = personalInfoKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    )
    
    // Assistant 관련 질문인지 확인
    const assistantKeywords = [
      '누가 만들었', '누가 만들었', '만들었', '만든', '만든 사람', '만든 분',
      '너는 누구', '너는 누구야', '너는 뭐야', '너는 무엇', '너는 뭘',
      '뭘 할 수 있어', '뭘 할 수 있', '할 수 있어', '할 수 있',
      'assistant', '어시스턴트', '챗봇', 'chatbot', '봇', 'bot',
      '너는', '너의', '너가', '당신은', '당신의', '당신이',
      '소개', '설명', '기능', '역할', '역할이 뭐', '역할은',
      '모델', 'model', '어떤 모델', '무슨 모델', '기반', '기반 모델'
    ]
    const isAssistantQuery = assistantKeywords.some(keyword => 
      messageLower.includes(keyword.toLowerCase())
    ) && (
      messageLower.includes('assistant') || 
      messageLower.includes('어시스턴트') || 
      messageLower.includes('챗봇') || 
      messageLower.includes('chatbot') ||
      messageLower.includes('봇') ||
      messageLower.includes('bot') ||
      messageLower.includes('너') ||
      messageLower.includes('당신') ||
      messageLower.includes('모델') ||
      messageLower.includes('model')
    )
    
    // 개인 정보 질문이면 프로젝트 필터 없이 검색 (resume 포함)
    // 프로젝트 특정 질문이면 프로젝트 필터 적용
    const shouldFilterByProject = projectId && !isPersonalInfoQuery
    
    // Gemini 3 Pro Thinking으로 스트리밍 응답 생성
    const history = conversationHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }))

    // chip 텍스트가 있으면 메시지에 명시적으로 포함
    const messageWithContext = selectedContext
      ? `${actualMessage}\n\n[User selected this context from the page: "${selectedContext}"]`
      : actualMessage

    // 스트림을 먼저 열어 로더/쉬머를 바로 보여 주고, 스트림 안에서 컨텍스트 fetch 후 생성기 실행
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false
        
        const safeEnqueue = (data: Uint8Array) => {
          if (isClosed) return
          try {
            controller.enqueue(data)
          } catch (error: any) {
            if (error?.code !== 'ERR_INVALID_STATE') {
              console.error('Enqueue error:', error)
            }
            isClosed = true
          }
        }
        
        const safeClose = () => {
          if (isClosed) return
          try {
            controller.close()
            isClosed = true
          } catch (error: any) {
            if (error?.code !== 'ERR_INVALID_STATE') {
              console.error('Close error:', error)
            }
            isClosed = true
          }
        }
        
        try {
          // 1) 즉시 전송 — 클라이언트가 로더+shimmer 및 steps UI 표시
          const thinkingPlaceholder = JSON.stringify({
            type: 'content',
            content: '',
            thinking: '',
            thinkingDone: false
          })
          safeEnqueue(new TextEncoder().encode(`data: ${thinkingPlaceholder}\n\n`))
          logAI('스트림 열림, thinking 플레이스홀더 전송', { elapsed: `${Date.now() - t0}ms` })

          // 2) 프로젝트 관련 여부는 LLM이 판단 (벡터 검색은 관련 있을 때만)
          const projectRelated = await isProjectRelated(actualMessage)
          logAI('컨텍스트 fetch 시작 (프로젝트·벡터검색·리스트)', { projectRelated })
          const contextStart = Date.now()
          const [fullProjectOrFallback, relevantContent, allProjects] = await Promise.all([
            (async (): Promise<{ id: string; title: string; subtitle?: string; content?: string } | undefined> => {
              if (!projectId) return undefined
              try {
                const project = await getProject(projectId)
                if (project) {
                  const translations = project.translations || {}
                  const currentTranslation = (projectListLanguage === 'en' ? translations.en :
                                            projectListLanguage === 'ko' ? translations.ko :
                                            projectListLanguage === 'it' ? translations.it : undefined)
                  const title = currentTranslation?.title || project.title || project.id
                  let subtitle: string | undefined
                  if (currentTranslation) {
                    const s =
                      currentTranslation.bannerSubtitle ||
                      (projectListLanguage === 'en' && project.subtitle ? project.subtitle : undefined)
                    subtitle = s?.trim() || undefined
                  } else if (
                    projectListLanguage === 'en' &&
                    (project.title || project.content || project.fields?.length)
                  ) {
                    subtitle = project.subtitle?.trim() || undefined
                  }
                  const rawContent = currentTranslation?.content || project.content || ''
                  const contentForFallback = typeof rawContent === 'string'
                    ? rawContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12_000)
                    : ''
                  return { id: project.id, title, subtitle, content: contentForFallback }
                }
                return { id: projectId, title: projectId }
              } catch (error) {
                console.error('[Chat API] Error fetching project:', error)
                return { id: projectId, title: projectId }
              }
            })(),
            (async () => {
              if (!projectRelated) return []
              try {
                // RAG는 현재 '한국어 CMS' 임베딩 내용을 읽고,
                // 응답 언어는 detectedLanguage(사용자 질문 언어: en/it/ko)로 생성합니다.
                const ragSearchLanguage: 'en' | 'ko' | 'it' = 'ko'
                return await searchRelevantContent(
                  searchQuery,
                  4, // 상위 4개 — 검색 누락 줄이기 (rag-stream top 4 · 12k chars)
                  shouldFilterByProject ? projectId : undefined,
                  ragSearchLanguage
                )
              } catch (error) {
                console.error('[Chat API] Error searching:', error)
                return []
              }
            })(),
            (async () => {
              if (!isProjectListPage) return []
              try {
                const { getProjects } = await import('@/lib/data')
                const projects = await getProjects()
                return Array.isArray(projects) ? projects : []
              } catch (error) {
                console.error('[Chat API] Error fetching projects:', error)
                return []
              }
            })()
          ])

          const finalContent = relevantContent
          const currentProject = fullProjectOrFallback
            ? {
                id: fullProjectOrFallback.id,
                title: fullProjectOrFallback.title,
                subtitle: fullProjectOrFallback.subtitle,
              }
            : undefined
          // 상세 페이지에서는 RAG 결과와 관계없이 전체 프로젝트 본문을 전달 (result 등 누락 방지)
          const fallbackProjectContent =
            fullProjectOrFallback?.content && projectId
              ? fullProjectOrFallback.content
              : undefined

          logAI('컨텍스트 fetch 완료', {
            chunks: finalContent.length,
            hasProject: !!currentProject,
            hasFallback: !!fallbackProjectContent,
            fetchMs: Date.now() - contextStart,
            elapsed: `${Date.now() - t0}ms`
          })

          // /portfolio 리스트 페이지일 때: 이 페이지에 있는 프로젝트 이름만 말하도록 목록 전달
          const projectsOnPage = isProjectListPage && Array.isArray(allProjects)
            ? allProjects
                .map((p) => getProjectOnPageForChat(p, projectListLanguage))
                .filter((x): x is NonNullable<typeof x> => x != null)
            : undefined

          const availableResumeLangs = await getAvailableResumeLangs()
          const generator = generateAIResponseStream(
            messageWithContext,
            finalContent,
            history,
            currentProject,
            detectedLanguage,
            greeting,
            isProjectListPage,
            projectsOnPage,
            fallbackProjectContent,
            pendingOpen && typeof pendingOpen.projectId === 'string' ? { projectId: pendingOpen.projectId, anchor: pendingOpen.anchor } : undefined,
            currentHash && typeof currentHash === 'string' ? currentHash : undefined,
            pageLang || undefined,
            availableResumeLangs
          )
          
          let chunkCount = 0
          try {
            for await (const chunk of generator) {
              chunkCount++
              if (chunkCount === 1) logAI('첫 청크 수신', { elapsed: `${Date.now() - t0}ms` })
              if (isClosed) break

              if (chunk.type === 'error') {
                console.error('[Chat API] Error chunk:', (chunk as any).content)
                const errorData = JSON.stringify({
                  type: 'error',
                  content: (chunk as any).content || '오류가 발생했습니다. 다시 시도해주세요.'
                })
                safeEnqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
                safeClose()
                return
              }

              const data = JSON.stringify({
                type: chunk.type,
                content: chunk.content,
                sources: chunk.type === 'done' ? chunk.sources : undefined,
                thinking: (chunk as any).thinking,
                deltaContent: (chunk as any).deltaContent,
                deltaThinking: (chunk as any).deltaThinking,
                thinkingDone: (chunk as any).thinkingDone
              })
              safeEnqueue(new TextEncoder().encode(`data: ${data}\n\n`))
            }
            if (chunkCount > 0) {
              logAI('스트림 완료', { chunks: chunkCount, elapsed: `${Date.now() - t0}ms` })
            }
          } catch (generatorError: any) {
            // Generator 내부 에러 처리
            console.error('[Chat API] Generator error:', generatorError)
            if (!isClosed && generatorError?.code !== 'ERR_INVALID_STATE') {
              const errorData = JSON.stringify({
                type: 'error',
                content: '스트리밍 중 오류가 발생했습니다.'
              })
              safeEnqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
            }
          }
          
          safeClose()
        } catch (error: any) {
          // ERR_INVALID_STATE는 무시 (이미 닫힌 상태)
          if (error?.code !== 'ERR_INVALID_STATE') {
            console.error('Streaming error:', error)
          }
          if (!isClosed) {
            try {
              const errorData = JSON.stringify({
                type: 'error',
                content: '오류가 발생했습니다. 다시 시도해주세요.'
              })
              safeEnqueue(new TextEncoder().encode(`data: ${errorData}\n\n`))
            } catch (e) {
              // 무시
            }
            safeClose()
          }
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // 할당량 초과 에러 처리
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let userMessage = '오류가 발생했습니다. 다시 시도해주세요.'
    
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Quota exceeded')) {
      userMessage = 'API 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요. (약 19초 후 재시도 가능)'
    } else if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      userMessage = 'API 키 오류가 발생했습니다. 설정을 확인해주세요.'
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      userMessage = '모델을 찾을 수 없습니다. Generative Language API가 활성화되어 있는지 확인해주세요.'
    } else {
      // 상세 에러 메시지 포함 (개발 환경에서만)
      userMessage = `오류가 발생했습니다: ${errorMessage.substring(0, 100)}`
    }
    
    return NextResponse.json(
      { 
        message: userMessage, 
        sources: []
      },
      { status: 500 }
    )
  }
}

