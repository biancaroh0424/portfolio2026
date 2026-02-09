'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProjectCard from '@/components/ProjectCard'
import ProjectChatInput from '@/components/ProjectChatInput'
import ProjectListSkeleton from '@/components/ProjectListSkeleton'
import { useLanguage } from '@/contexts/LanguageContext'
import { useChatBot } from '@/contexts/ChatBotContext'

const CHATBOT_CLOSED_BY_USER_KEY = 'chatbot-closed-by-user'

const LOAD_TIMEOUT_MS = 8000 // 이 시간 지나면 무조건 로딩 해제 (스켈레톤에 갇힘 방지)

type ProjectField = { label?: string; value?: string; type?: string }

// 현재 언어의 translation을 가져오는 헬퍼 함수
const getProjectTranslation = (project: any, language: 'en' | 'ko' | 'it') => {
  // 해당 언어의 translation이 있으면 반환
  if (project.translations?.[language]) {
    return {
      title: project.translations[language].title || '',
      content: project.translations[language].content || '',
      fields: project.translations[language].fields || [],
      tags: project.translations[language].tags || []
    }
  }
  // 하위 호환성: 기존 프로젝트는 title, content, fields를 사용 (영어로만 저장된 경우)
  // 단, 현재 언어가 영어일 때만 하위 호환성 적용
  if (language === 'en' && (project.title || project.content || project.fields)) {
    return {
      title: project.title || '',
      content: project.content || '',
      fields: project.fields || [],
      tags: project.tags || [] // 하위 호환성: 기존 tags 필드 사용
    }
  }
  // 해당 언어의 translation이 없으면 빈값 반환
  return {
    title: '',
    content: '',
    fields: [],
    tags: []
  }
}

export default function ProjectsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language } = useLanguage()
  const { openChatBot } = useChatBot()
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const forceSkeleton = searchParams?.get('skeleton') === '1'

  // /portfolio 진입 시 ChatBot 열기 (모바일 744px 이하는 자동 열기 안 함. 유저가 닫아둔 상태가 아닐 때만)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const tryOpen = () => {
      if (window.innerWidth <= 743) return
      if (localStorage.getItem(CHATBOT_CLOSED_BY_USER_KEY) !== 'true') openChatBot()
    }
    tryOpen()
    const t1 = setTimeout(tryOpen, 100)
    const t2 = setTimeout(tryOpen, 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProjects = useCallback(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)
    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/admin/projects?t=${timestamp}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      clearTimeout(timeoutId)
      if (response.ok) {
        const data = await response.json()
        setProjects(Array.isArray(data) ? data : [])
      } else {
        setProjects([])
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if ((error as Error)?.name === 'AbortError') {
        console.warn('Projects fetch timeout')
      } else {
        console.error('Error loading projects:', error)
      }
      setProjects([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 초기 로드 및 언어 변경 시 로드
  useEffect(() => {
    if (forceSkeleton) return
    setIsLoading(true)
    loadProjects()

    // 프로덕션: fetch/네트워크 문제로 완료되지 않아도 N초 후 무조건 로딩 해제
    const safetyTimer = setTimeout(() => {
      setIsLoading(false)
    }, LOAD_TIMEOUT_MS)

    return () => clearTimeout(safetyTimer)
  }, [language, loadProjects, forceSkeleton])

  // 주기적으로 프로젝트 데이터 업데이트 확인 (1분마다, 페이지가 보일 때만)
  useEffect(() => {
    if (forceSkeleton) return
    // 페이지가 숨겨져 있으면 폴링하지 않음
    if (document.hidden) return
    
    const interval = setInterval(() => {
      // 페이지가 보이는 상태일 때만 업데이트
      if (!document.hidden) {
        loadProjects()
      }
    }, 60000) // 1분마다 확인 (서버 부하 감소)

    return () => clearInterval(interval)
  }, [loadProjects, forceSkeleton])

  // 페이지 포커스/가시성 변경 시 프로젝트 데이터 다시 로드 (폴링보다 우선)
  useEffect(() => {
    if (forceSkeleton) return
    let visibilityTimeout: NodeJS.Timeout | null = null

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 페이지가 다시 보일 때 약간의 지연 후 업데이트 (너무 빈번한 업데이트 방지)
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout)
        }
        visibilityTimeout = setTimeout(() => {
          loadProjects()
        }, 1000) // 1초 지연
      }
    }

    const handleFocus = () => {
      // 포커스 시에도 약간의 지연 후 업데이트
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout)
      }
      visibilityTimeout = setTimeout(() => {
        loadProjects()
      }, 1000) // 1초 지연
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadProjects, forceSkeleton])

  if (forceSkeleton || isLoading) {
    return <ProjectListSkeleton />
  }

  return (
    <div className="min-h-screen projects-page">
      {/* Main container - padding: 200px 0, flex-direction: column, align-items: center */}
      <div style={{ 
        display: 'flex',
        padding: '200px 0',
        flexDirection: 'column',
        alignItems: 'center',
        alignSelf: 'stretch'
      }}>
        {/* Title layout - max-width: 1160px, flex-direction: column, gap: 16px */}
        <div style={{
          display: 'flex',
          padding: '0 16px',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: '16px',
          alignSelf: 'stretch',
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%',
        }}>
          <div style={{
            display: 'flex',
            maxWidth: '1160px',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '16px',
            alignSelf: 'stretch',
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
          }}>
            <h1 
              className="projects-page-title"
              style={{
                color: '#FFF',
                fontFamily: '"Noto Serif KR", serif',
                fontSize: '48px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: '140%',
                margin: 0,
                width: '100%',
                cursor: 'default'
              }}
            >
              Portfolio
            </h1>
          </div>
        </div>

        {/* Lists layout - padding-top: 49px, flex-direction: column */}
        <div style={{
          display: 'flex',
          paddingTop: '49px',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          alignSelf: 'stretch'
        }}>
          {projects
            .filter((project) => {
              // 해당 언어의 제목이 있는 프로젝트만 표시
              const translation = getProjectTranslation(project, language)
              return translation.title && translation.title.trim() !== ''
            })
            .map((project) => {
              const translation = getProjectTranslation(project, language)
              const keyResult = translation.fields?.find((f: ProjectField) => 
                f.label?.toLowerCase().includes('key result') || 
                f.label?.toLowerCase().includes('주요 결과') ||
                f.label?.toLowerCase().includes('keyresult')
              )?.value || ''
              
              // Duration 필드 찾기 (type이 'duration'인 필드)
              const durationField = translation.fields?.find((f: ProjectField) => 
                f.type === 'duration' || 
                (f.type === 'default' && f.label?.toLowerCase().includes('duration'))
              )
              const duration = durationField?.value?.trim() || ''
              
              // Summary 필드 찾기 (type이 'summary'인 필드)
              const summaryField = translation.fields?.find((f: ProjectField) => f.type === 'summary')
              const summary = summaryField?.value?.trim() || ''
              
              return (
                <ProjectCard
                  key={project.id}
                  project={{
                    ...project,
                    title: translation.title,
                    period: translation.fields?.find((f: ProjectField) => 
                      f.label?.toLowerCase().includes('period') || 
                      f.label?.toLowerCase().includes('기간') ||
                      (f.label?.toLowerCase().includes('duration') && f.type !== 'duration')
                    )?.value || '',
                    duration: duration,
                    summary: summary,
                    keyResult: keyResult,
                    tags: Array.isArray(translation.tags) ? translation.tags : []
                  }}
                  onClick={() => router.push(`/portfolio/${project.id}`)}
                />
              )
            })}
          {projects.length === 0 && (
            <div className="text-center py-12 text-gray-500" style={{ alignSelf: 'stretch' }}>
              프로젝트가 없습니다.
            </div>
          )}
        </div>
      </div>
      <ProjectChatInput />
    </div>
  )
}

