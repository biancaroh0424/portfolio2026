'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatProjectTitle } from '@/lib/utils'
import ChapterStatus from '@/components/ChapterStatus'
import ProjectChatInput from '@/components/ProjectChatInput'
import { useLanguage } from '@/contexts/LanguageContext'

// 현재 언어의 translation을 가져오는 헬퍼 함수
const getProjectTranslation = (project: any, language: 'en' | 'ko' | 'it') => {
  // 해당 언어의 translation이 있으면 반환
  if (project.translations?.[language]) {
    return {
      title: project.translations[language].title || '',
      content: project.translations[language].content || '',
      fields: project.translations[language].fields || []
    }
  }
  // 하위 호환성: 기존 프로젝트는 title, content, fields를 사용 (영어로만 저장된 경우)
  // 단, 현재 언어가 영어일 때만 하위 호환성 적용
  if (language === 'en' && (project.title || project.content || project.fields)) {
    return {
      title: project.title || '',
      content: project.content || '',
      fields: project.fields || []
    }
  }
  // 해당 언어의 translation이 없으면 빈값 반환
  return {
    title: '',
    content: '',
    fields: []
  }
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const { language } = useLanguage()
  const [project, setProject] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [expandedVideo, setExpandedVideo] = useState<{ src: string; caption?: string } | null>(null)
  const [isChapterOpen, setIsChapterOpen] = useState(true)
  const [windowWidth, setWindowWidth] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  // 화면 크기 추적
  useEffect(() => {
    const updateWindowWidth = () => {
      setWindowWidth(window.innerWidth)
    }
    
    // 초기값 설정
    updateWindowWidth()
    
    window.addEventListener('resize', updateWindowWidth)
    return () => window.removeEventListener('resize', updateWindowWidth)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        // API를 통해 최신 프로젝트 데이터 가져오기 (캐시 없이, 타임스탬프 추가)
        const timestamp = Date.now()
        const response = await fetch(`/api/admin/projects?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        })
        if (response.ok) {
          const projectsData = await response.json()
          setProjects(projectsData)
          const projectData = projectsData.find((p: any) => p.id === projectId)
          setProject(projectData || null)
        } else {
          console.error('Failed to load projects')
        }
      } catch (error) {
        console.error('Error loading project:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [projectId, language])

  // 현재 언어의 translation 가져오기 (없어도 빈값으로 반환됨)
  const currentTranslation = project ? getProjectTranslation(project, language) : null

  // h1-h6 태그에 id 추가 및 anchor 스크롤 처리, 이미지 클릭 이벤트 추가
  useEffect(() => {
    if (!currentTranslation?.content) return
    const content = currentTranslation.content

    // HTML 콘텐츠가 렌더링된 후 실행
    const timer = setTimeout(() => {
      // 모든 h1-h6 태그에 id 추가
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const seenAnchors = new Set<string>()
      
      headings.forEach((heading) => {
        const text = heading.textContent?.trim() || ''
        if (text && !heading.id) {
          // anchor 생성: 제목을 소문자로 변환하고 공백을 하이픈으로, 특수문자 제거
          let anchorBase = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          
          // 빈 문자열이거나 하이픈만 있는 경우 처리
          if (!anchorBase || anchorBase === '-' || /^-+$/.test(anchorBase)) {
            // 텍스트에서 영문자나 숫자가 있는 경우 그 부분만 사용
            const alphanumeric = text.toLowerCase().match(/[a-z0-9]+/g)
            if (alphanumeric && alphanumeric.length > 0) {
              anchorBase = alphanumeric.join('-')
            } else {
              // 영문자나 숫자가 없으면 인덱스 기반 ID 사용
              anchorBase = `heading-${seenAnchors.size + 1}`
            }
          }
          
          // 고유한 anchor 생성
          let anchor = anchorBase
          let counter = 1
          while (seenAnchors.has(anchor)) {
            anchor = `${anchorBase}-${counter}`
            counter++
          }
          seenAnchors.add(anchor)
          
          heading.id = anchor
        }
      })

      // URL의 hash가 있으면 해당 anchor로 스크롤
      if (window.location.hash) {
        const hash = window.location.hash.substring(1)
        const element = document.getElementById(hash)
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [currentTranslation?.content, language])

  // 이미지/비디오 클릭 이벤트 추가 (이벤트 위임 사용)
  useEffect(() => {
    if (!currentTranslation?.content) return

    const handleMediaClick = (e: Event) => {
      const target = e.target as HTMLElement
      const img = target.closest('img')
      const video = target.closest('video')
      
      // 이미지 클릭
      if (img) {
        // thumbnail 컨테이너 내부의 이미지는 제외
        if (img.closest('.project-thumbnail-container')) {
          return
        }
        
        e.stopPropagation()
        e.preventDefault()
        setExpandedImage(img.src)
        return
      }
      
      // 비디오 클릭
      if (video) {
        e.stopPropagation()
        e.preventDefault()
        
        // 비디오의 src와 caption 찾기
        const videoSrc = (video as HTMLVideoElement).src || (video as HTMLVideoElement).getAttribute('src')
        if (videoSrc) {
          // figure 내부의 figcaption 찾기
          const figure = video.closest('figure')
          let caption: string | undefined
          if (figure) {
            const figcaption = figure.querySelector('figcaption')
            if (figcaption) {
              caption = figcaption.textContent?.trim() || undefined
            }
          }
          
          setExpandedVideo({ src: videoSrc, caption })
        }
        return
      }
    }

    // 이벤트 위임: prose 컨테이너에 이벤트 리스너 추가
    const timer = setTimeout(() => {
      const proseContainer = document.querySelector('.prose, .prose-lg')
      if (proseContainer) {
        proseContainer.addEventListener('click', handleMediaClick)
      }
    }, 200)

    return () => {
      clearTimeout(timer)
      const proseContainer = document.querySelector('.prose, .prose-lg')
      if (proseContainer) {
        proseContainer.removeEventListener('click', handleMediaClick)
      }
    }
  }, [currentTranslation?.content, language])

  // 모바일: prose 내 .editor-table을 스크롤 래퍼로 감싸 가로 스크롤 가능하게
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = contentRef.current
    if (!root) return
    root.querySelectorAll('.editor-table').forEach((table) => {
      if ((table as HTMLElement).closest('.table-scroll-wrapper')) return
      const wrap = document.createElement('div')
      wrap.className = 'table-scroll-wrapper'
      table.parentNode?.insertBefore(wrap, table)
      wrap.appendChild(table)
    })
  }, [currentTranslation?.content, language])

  // 비디오 자동 재생 (Intersection Observer 사용)
  useEffect(() => {
    if (!currentTranslation?.content || isLoading) return

    let observer: IntersectionObserver | null = null

    const timer = setTimeout(() => {
      const videos = document.querySelectorAll('.prose video, .prose-lg video')
      
      if (videos.length === 0) return

      // 모든 비디오에 playsInline 속성 추가 (모바일에서 인라인 재생)
      videos.forEach((video) => {
        const videoElement = video as HTMLVideoElement
        videoElement.setAttribute('playsinline', 'true')
        videoElement.setAttribute('webkit-playsinline', 'true')
        videoElement.setAttribute('x5-playsinline', 'true')
        videoElement.setAttribute('x5-video-player-type', 'h5')
        videoElement.playsInline = true
      })

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const video = entry.target as HTMLVideoElement
            if (entry.isIntersecting) {
              // 뷰포트에 들어오면 재생
              video.play().catch((error) => {
                // 자동 재생이 차단된 경우 무시
                console.log('Video autoplay prevented:', error)
              })
            } else {
              // 뷰포트를 벗어나면 일시정지
              video.pause()
            }
          })
        },
        {
          threshold: 0.5, // 50% 이상 보일 때 재생
          rootMargin: '0px',
        }
      )

      videos.forEach((video) => {
        observer?.observe(video)
      })
    }, 300)

    return () => {
      clearTimeout(timer)
      if (observer) {
        observer.disconnect()
      }
      // cleanup에서 모든 비디오 일시정지
      const videos = document.querySelectorAll('.prose video, .prose-lg video')
      videos.forEach((video) => {
        const videoElement = video as HTMLVideoElement
        videoElement.pause()
      })
    }
  }, [currentTranslation?.content, language, isLoading])

  // 스켈레톤 UI
  if (isLoading || !project) {
    return (
      <div className="min-h-screen">
        <div className="flex flex-col md:flex-row">
          {/* ChapterStatus 스켈레톤 - 모바일에서 숨김 */}
          <div
            className="hidden md:block sticky top-[80px] left-0 z-30 self-start"
            style={{
              width: '260px',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '0',
              maxHeight: 'calc(100vh - 80px)',
            }}
          >
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: '60%' }} />
              <div className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: '80%', marginLeft: '16px' }} />
              <div className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: '70%', marginLeft: '16px' }} />
              <div className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: '90%', marginLeft: '24px' }} />
              <div className="h-3 bg-gray-700 rounded animate-pulse" style={{ width: '75%', marginLeft: '24px' }} />
            </div>
          </div>

          {/* 콘텐츠 스켈레톤 */}
          <div
            className="flex-1 w-full max-w-[980px] mx-auto"
            style={{
              marginLeft: 'auto',
              marginRight: 'auto',
              width: '100%',
              maxWidth: '980px',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingTop: '80px',
              paddingBottom: '80px',
            }}
          >
            <div className="space-y-6">
              {/* 썸네일 스켈레톤 */}
              <div className="h-48 md:h-64 bg-gray-700 rounded-lg animate-pulse" style={{ aspectRatio: '9 / 4' }} />
              
              {/* 제목 스켈레톤 */}
              <div className="space-y-2">
                <div className="h-6 md:h-8 bg-gray-700 rounded animate-pulse" style={{ width: '60%' }} />
                <div className="h-6 md:h-8 bg-gray-700 rounded animate-pulse" style={{ width: '40%' }} />
              </div>

              {/* Project Summary 스켈레톤 */}
              <div className="space-y-2">
                <div className="h-6 bg-gray-700 rounded animate-pulse" style={{ width: '40%' }} />
                <div className="space-y-0">
                  <div className="h-12 md:h-16 bg-gray-700 rounded animate-pulse" />
                  <div className="h-12 md:h-16 bg-gray-700 rounded animate-pulse" />
                  <div className="h-12 md:h-16 bg-gray-700 rounded animate-pulse" />
                </div>
              </div>

              {/* 콘텐츠 스켈레톤 */}
              <div className="space-y-4">
                <div className="h-4 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: '95%' }} />
                <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: '90%' }} />
                <div className="h-48 md:h-64 bg-gray-700 rounded-lg animate-pulse" />
                <div className="h-4 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: '85%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // 제목과 콘텐츠가 모두 없으면 빈 페이지 표시
  if (!currentTranslation || (!currentTranslation.title && !currentTranslation.content)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>이 언어로 작성된 콘텐츠가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="flex">
        {/* ChapterStatus 사이드바 */}
        {currentTranslation?.content && (
          <ChapterStatus 
            content={currentTranslation.content || ''} 
            title={currentTranslation.title}
            onToggle={setIsChapterOpen}
          />
        )}
        
        <div 
          className="portfolio-content-container flex-1 w-full max-w-[980px] mx-auto transition-all duration-300 ease-in-out" 
          style={{ 
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
            maxWidth: '980px',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '80px',
            paddingBottom: '80px'
          }}
        >
        <div>
          {/* Project Content */}
          <div>
            <div className="mb-8">
              {project.thumbnail ? (
                <div className="relative mb-6 rounded-lg overflow-hidden project-thumbnail-container" style={{ aspectRatio: '9 / 4' }}>
                  <img
                    src={project.thumbnail}
                    alt={currentTranslation?.title || ''}
                    className="w-full h-full object-cover"
                  />
                  {/* Title 오버레이 */}
                  {currentTranslation?.title && (
                    <div className="absolute inset-0 flex items-center px-6 pointer-events-none">
                      <h1 className="text-title-4-bold text-white">{formatProjectTitle(currentTranslation.title)}</h1>
                    </div>
                  )}
                </div>
              ) : (
                currentTranslation?.title && (
                  <h1 className="text-title-4-bold text-white mb-6">{formatProjectTitle(currentTranslation.title)}</h1>
                )
              )}
              
              {/* Project Summary */}
              {currentTranslation?.fields && currentTranslation.fields.length > 0 && (
                <div className="mt-8" style={{ paddingBottom: '80px' }}>
                  <h2 className="text-title-2-bold text-white mb-6">Project Summary</h2>
                  <div 
                    className="space-y-0 project-summary-container"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {currentTranslation.fields.map((field: any, index: number) => (
                      field.value && (
                        <div key={index}>
                          {field.type === 'note' ? (
                            <div className="py-4">
                              <span 
                                className="whitespace-pre-line project-summary-content"
                                style={{
                                  color: 'var(--text-label, #E6E6E6)',
                                  fontFamily: '"Pretendard Variable"',
                                  fontSize: '13px',
                                  fontStyle: 'normal',
                                  fontWeight: '400',
                                  lineHeight: '160%',
                                }}
                              >
                                {field.value}
                              </span>
                            </div>
                          ) : (
                            field.label && (
                              <div 
                                className="py-4 border-b border-white border-opacity-10 project-summary-item"
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                }}
                              >
                                <span 
                                  className="project-summary-label"
                                  style={{
                                    color: 'var(--text-label, #E6E6E6)',
                                    fontFamily: '"Noto Serif KR"',
                                    fontSize: '16px',
                                    fontStyle: 'normal',
                                    fontWeight: '500',
                                    lineHeight: '160%',
                                    marginBottom: '4px',
                                  }}
                                >
                                  {field.label}
                                </span>
                                <span 
                                  className="whitespace-pre-line project-summary-content"
                                  style={{
                                    color: 'var(--text-label, #E6E6E6)',
                                    fontFamily: '"Noto Serif KR"',
                                    fontSize: '16px',
                                    fontStyle: 'normal',
                                    fontWeight: '500',
                                    lineHeight: '160%',
                                  }}
                                >
                                  {field.value}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Project Content */}
            {currentTranslation?.content ? (
              <div 
                ref={contentRef}
                key={`content-${project.id}-${language}`}
                className="prose prose-lg prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:shadow-lg max-w-none w-full"
                style={{ 
                  paddingTop: '120px', 
                  paddingBottom: '80px', 
                  width: '100%', 
                  maxWidth: 'none',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word'
                }}
                dangerouslySetInnerHTML={{ __html: currentTranslation.content }}
              />
            ) : (
              /* 하위 호환성: 섹션 기반 표시 */
              project.sections?.map((section: any, index: number) => (
                <div
                  key={index}
                  id={`section-${section.id || index}`}
                  className="mb-12 scroll-mt-24"
                >
                  <h2 className="text-2xl font-semibold mb-4 ">{section.title}</h2>
                  {section.image && (
                    <div className="mb-4">
                      <img
                        src={section.image}
                        alt={section.title}
                        className="w-full rounded-lg shadow-lg"
                      />
                    </div>
                  )}
                  {section.content && (
                    <div className="prose prose-lg max-w-none">
                      {Array.isArray(section.content) ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {section.content.join('\n')}
                        </ReactMarkdown>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {section.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </div>

      {/* 프로젝트 채팅 인풋창 */}
      <ProjectChatInput />

      {/* 이미지 확대 모달 */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'var(--fill-black-10)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={expandedImage}
              alt="Expanded"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 비디오 확대 모달 */}
      {expandedVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'var(--fill-black-10)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => setExpandedVideo(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={expandedVideo.src}
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              x5-video-player-type="h5"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '90vw',
                maxHeight: '85vh',
              }}
            />
            {expandedVideo.caption && (
              <div
                className="mt-4 text-center"
                style={{
                  fontFamily: 'Pretendard Variable, sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: '1.6',
                  color: 'var(--greyscale-100)',
                }}
              >
                {expandedVideo.caption}
              </div>
            )}
            <button
              onClick={() => setExpandedVideo(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full transition-all"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

