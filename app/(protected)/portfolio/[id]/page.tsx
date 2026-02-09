'use client'

import { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatProjectTitle } from '@/lib/utils'
import ChapterStatus from '@/components/ChapterStatus'
import ProjectDetailSkeleton from '@/components/ProjectDetailSkeleton'
import ProjectChatInput from '@/components/ProjectChatInput'
import { useLanguage } from '@/contexts/LanguageContext'
import { useChatBot } from '@/contexts/ChatBotContext'

const CHATBOT_CLOSED_BY_USER_KEY = 'chatbot-closed-by-user'

// 고정 네비(80px) 아래로 섹션 제목이 보이도록 스크롤 오프셋 (반응형 동일)
const SCROLL_OFFSET_PX = 100
const ANCHOR_HIGHLIGHT_CLASS = 'anchor-highlight'
const ANCHOR_HIGHLIGHT_DURATION_MS = 2200

function scrollToElementWithOffset(element: HTMLElement, offsetPx: number, behavior: ScrollBehavior = 'auto') {
  const top = element.getBoundingClientRect().top + window.scrollY - offsetPx
  window.scrollTo({ top: Math.max(0, top), behavior })
  // 레이아웃 시프트(이미지/폰트 로드 등) 보정: 잠시 후 같은 요소로 다시 스크롤
  setTimeout(() => {
    const again = element.getBoundingClientRect().top + window.scrollY - offsetPx
    if (Math.abs((window.scrollY || 0) - again) > 20) {
      window.scrollTo({ top: Math.max(0, again), behavior: 'auto' })
    }
  }, 150)
}

function applyAnchorHighlight(element: HTMLElement, clearRef?: { timeoutId: ReturnType<typeof setTimeout> | null }) {
  if (clearRef?.timeoutId) clearTimeout(clearRef.timeoutId)
  document.querySelectorAll(`.${ANCHOR_HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(ANCHOR_HIGHLIGHT_CLASS))
  element.classList.add(ANCHOR_HIGHLIGHT_CLASS)
  const timeoutId = setTimeout(() => {
    element.classList.remove(ANCHOR_HIGHLIGHT_CLASS)
    if (clearRef) clearRef.timeoutId = null
  }, ANCHOR_HIGHLIGHT_DURATION_MS)
  if (clearRef) clearRef.timeoutId = timeoutId
}

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
  const { openChatBot } = useChatBot()
  const [project, setProject] = useState<any>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [expandedVideo, setExpandedVideo] = useState<{ src: string; caption?: string } | null>(null)
  const modalScrollYRef = useRef(0)
  const [isChapterOpen, setIsChapterOpen] = useState(true)
  const [windowWidth, setWindowWidth] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const cleanupRef = useRef<(() => void) | null>(null)
  const lastScrolledHashRef = useRef<string | null>(null)
  const anchorHighlightClearRef = useRef<{ timeoutId: ReturnType<typeof setTimeout> | null }>({ timeoutId: null })
  const [targetHash, setTargetHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
  )

  // URL hash 동기화 (챗봇에서 섹션으로 이동 시 hash 유지)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash && window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual'
    }
    setTargetHash(typeof window !== 'undefined' ? window.location.hash.slice(1) : '')
    const onHashChange = () => {
      const newHash = window.location.hash.slice(1)
      setTargetHash(newHash)
      // 다른 hash로 이동할 때만 스크롤 허용 (이미 스크롤한 hash로 돌아와도 한 번 더 스크롤 가능하도록 초기화)
      lastScrolledHashRef.current = null
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // /portfolio 상세 진입 시 ChatBot 열기 (유저가 닫아둔 상태가 아닐 때만. Context pathname sync와 타이밍 이슈 대비해 여러 번 시도)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const tryOpen = () => {
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

  // hash가 있을 때 전용 스크롤: 콘텐츠 로드 후에도 재시도 (챗봇에서 섹션 이동 시)
  // targetHash + 콘텐츠 준비 시점(project/content) 모두 의존 → URL hash로 진입해도 로드 후 스크롤
  const contentReady = !!(project?.id && (currentTranslation?.content || (project.sections?.length ?? 0) > 0))

  // content 로드 직후 URL hash 다시 반영 (챗봇에서 링크 열었을 때 hash가 아직 targetHash에 없을 수 있음)
  useEffect(() => {
    if (!contentReady || typeof window === 'undefined') return
    const hashFromUrl = window.location.hash.slice(1)
    if (hashFromUrl && hashFromUrl !== targetHash) setTargetHash(hashFromUrl)
  }, [contentReady])

  const getContentHeadings = () => {
    const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current ?? document.querySelector('.portfolio-content-container .prose.prose-lg')
    return container ? container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6') : document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  }

  // contentReady일 때 항상 페인트 전에 헤딩 id 부여 → ChapterStatus가 목차를 채울 수 있도록
  // hash가 있으면 그때만 스크롤 (위로 갔다 내려오는 깜빡임 방지)
  useLayoutEffect(() => {
    if (!contentReady) return

    const assignHeadingIds = () => {
      const headings = getContentHeadings()
      const seenSlugs = new Set<string>()
      headings.forEach((heading, index) => {
        const positionId = `heading-${index + 1}`
        if (!heading.id || heading.id !== positionId) heading.id = positionId
        const text = heading.textContent?.trim() || ''
        if (text) {
          let slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
          if (!slug || slug === '-' || /^-+$/.test(slug)) {
            const alphanumeric = text.toLowerCase().match(/[a-z0-9]+/g)
            slug = alphanumeric?.length ? alphanumeric.join('-') : `heading-${index + 1}`
          }
          let uniqueSlug = slug
          let c = 1
          while (seenSlugs.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${c}`
            c++
          }
          seenSlugs.add(uniqueSlug)
          heading.setAttribute('data-heading-slug', uniqueSlug)
        }
      })
    }
    assignHeadingIds()

    const hashToUse = targetHash || (typeof window !== 'undefined' ? window.location.hash.slice(1) : '')
    if (!hashToUse) return
    if (lastScrolledHashRef.current === hashToUse) return

    if (typeof window !== 'undefined' && window.history?.scrollRestoration) {
      window.history.scrollRestoration = 'manual'
    }

    const doScrollAndHighlight = () => {
      assignHeadingIds()
      let element: HTMLElement | null = document.getElementById(hashToUse)
      const headingMatch = hashToUse.match(/^heading-(\d+)$/)
      if (!element && headingMatch) {
        const headings = getContentHeadings()
        const index = parseInt(headingMatch[1], 10) - 1
        if (index >= 0 && index < headings.length) element = headings[index] as HTMLElement
      }
      if (!element) {
        const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
        if (container) {
          const bySlugCandidates = container.querySelectorAll<HTMLElement>('[data-heading-slug]')
          let decoded = hashToUse
          try { decoded = decodeURIComponent(hashToUse) } catch { /* ignore */ }
          for (const el of bySlugCandidates) {
            const slug = el.getAttribute('data-heading-slug')
            if (slug === hashToUse || slug === decoded) {
              element = el
              break
            }
          }
        }
      }
      // slug 없으면 제목 텍스트로 검색 (예: Solution, solution)
      if (!element) {
        const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
        if (container) {
          const headings = container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
          const want = hashToUse.toLowerCase().replace(/-/g, ' ')
          for (const h of headings) {
            const text = h.textContent?.trim().toLowerCase().replace(/\s+/g, ' ')
            if (text === want || text?.replace(/\s+/g, '-') === hashToUse.toLowerCase()) {
              element = h
              break
            }
          }
        }
      }
      if (element) {
        scrollToElementWithOffset(element, SCROLL_OFFSET_PX, 'auto')
        lastScrolledHashRef.current = hashToUse
        applyAnchorHighlight(element, anchorHighlightClearRef.current)
      }
    }

    // 한 프레임 뒤 실행해 DOM(dangerouslySetInnerHTML) 적용 후 스크롤/하이라이트
    const rafId = requestAnimationFrame(() => {
      doScrollAndHighlight()
    })
    return () => cancelAnimationFrame(rafId)
  }, [targetHash, contentReady])

  // useLayoutEffect에서 요소를 못 찾았을 때만 재시도 (DOM 지연 렌더 등)
  useEffect(() => {
    const hashToUse = targetHash || (typeof window !== 'undefined' ? window.location.hash.slice(1) : '')
    if (!hashToUse || lastScrolledHashRef.current === hashToUse) return

    const tryScrollToHash = (): boolean => {
      const assignHeadingIds = () => {
        const headings = getContentHeadings()
        const seenSlugs = new Set<string>()
        headings.forEach((heading, index) => {
          const positionId = `heading-${index + 1}`
          if (!heading.id || heading.id !== positionId) heading.id = positionId
          const text = heading.textContent?.trim() || ''
          if (text) {
            let slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
            if (!slug || slug === '-' || /^-+$/.test(slug)) {
              const alphanumeric = text.toLowerCase().match(/[a-z0-9]+/g)
              slug = alphanumeric?.length ? alphanumeric.join('-') : `heading-${index + 1}`
            }
            let uniqueSlug = slug
            let c = 1
            while (seenSlugs.has(uniqueSlug)) {
              uniqueSlug = `${slug}-${c}`
              c++
            }
            seenSlugs.add(uniqueSlug)
            heading.setAttribute('data-heading-slug', uniqueSlug)
          }
        })
      }
      assignHeadingIds()
      let element = document.getElementById(hashToUse)
      const headingMatch = hashToUse.match(/^heading-(\d+)$/)
      if (!element && headingMatch) {
        const headings = getContentHeadings()
        const index = parseInt(headingMatch[1], 10) - 1
        if (index >= 0 && index < headings.length) element = headings[index]
      }
      if (!element) {
        const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
        if (container) {
          const bySlugCandidates = container.querySelectorAll<HTMLElement>('[data-heading-slug]')
          let decoded = hashToUse
          try { decoded = decodeURIComponent(hashToUse) } catch { /* ignore */ }
          for (const el of bySlugCandidates) {
            const slug = el.getAttribute('data-heading-slug')
            if (slug === hashToUse || slug === decoded) {
              element = el
              break
            }
          }
        }
      }
      if (!element) {
        const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
        if (container) {
          const headings = container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
          const want = hashToUse.toLowerCase().replace(/-/g, ' ')
          for (const h of headings) {
            const text = h.textContent?.trim().toLowerCase().replace(/\s+/g, ' ')
            if (text === want || text?.replace(/\s+/g, '-') === hashToUse.toLowerCase()) {
              element = h
              break
            }
          }
        }
      }
      if (element) {
        scrollToElementWithOffset(element, SCROLL_OFFSET_PX, 'auto')
        lastScrolledHashRef.current = hashToUse
        applyAnchorHighlight(element, anchorHighlightClearRef.current)
        return true
      }
      return false
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    const initialDelay = setTimeout(() => {
      if (tryScrollToHash()) return
      intervalId = setInterval(() => {
        if (tryScrollToHash() && intervalId) {
          clearInterval(intervalId)
          intervalId = null
        }
      }, 400)
    }, 50)
    const timeoutId = setTimeout(() => {
      if (intervalId) clearInterval(intervalId)
    }, 8000)

    return () => {
      clearTimeout(initialDelay)
      if (intervalId) clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [targetHash, contentReady])

  // h1-h6 태그에 id 추가 및 anchor 스크롤 처리 (본문 prose 영역만 사용)
  useEffect(() => {
    if (!currentTranslation?.content) return

    const getContentHeadings = () => {
      const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current ?? document.querySelector('.portfolio-content-container .prose.prose-lg')
      return container ? container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6') : document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
    }

    const assignHeadingIds = () => {
      const headings = getContentHeadings()
      const seenSlugs = new Set<string>()
      headings.forEach((heading, index) => {
        const positionId = `heading-${index + 1}`
        if (!heading.id || heading.id !== positionId) heading.id = positionId
        const text = heading.textContent?.trim() || ''
        if (text) {
          let slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
          if (!slug || slug === '-' || /^-+$/.test(slug)) {
            const alphanumeric = text.toLowerCase().match(/[a-z0-9]+/g)
            slug = alphanumeric?.length ? alphanumeric.join('-') : `heading-${index + 1}`
          }
          let uniqueSlug = slug
          let c = 1
          while (seenSlugs.has(uniqueSlug)) {
            uniqueSlug = `${slug}-${c}`
            c++
          }
          seenSlugs.add(uniqueSlug)
          heading.setAttribute('data-heading-slug', uniqueSlug)
        }
      })
    }

    // hash로의 초기 스크롤은 위의 targetHash effect에서만 수행. 여기서는 id 부여 + hashchange 시에만 스크롤 (중복 스크롤로 인한 '위로 갔다 내려옴' 방지)
    assignHeadingIds()

    const scrollToHash = () => {
      if (!window.location.hash) return
      const hash = window.location.hash.substring(1)
      // AI(챗봇)에서 hash 설정 시 setTargetHash로 리렌더가 일어나 하이라이트가 사라지므로, 한 프레임 뒤에 스크롤/하이라이트 실행
      requestAnimationFrame(() => {
        assignHeadingIds()
        let element: HTMLElement | null = document.getElementById(hash)
        const headingMatch = hash.match(/^heading-(\d+)$/)
        if (!element && headingMatch) {
          const headings = getContentHeadings()
          const index = parseInt(headingMatch[1], 10) - 1
          if (index >= 0 && index < headings.length) element = headings[index]
        }
        if (!element) {
          const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
          if (container) {
            const bySlugCandidates = container.querySelectorAll<HTMLElement>('[data-heading-slug]')
            let decoded = hash
            try { decoded = decodeURIComponent(hash) } catch { /* ignore */ }
            for (const el of bySlugCandidates) {
              const slug = el.getAttribute('data-heading-slug')
              if (slug === hash || slug === decoded) {
                element = el
                break
              }
            }
          }
        }
        if (!element) {
          const container = document.querySelector('[data-portfolio-body]') ?? contentRef.current
          if (container) {
            const headings = container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
            const want = hash.toLowerCase().replace(/-/g, ' ')
            for (const h of headings) {
              const text = h.textContent?.trim().toLowerCase().replace(/\s+/g, ' ')
              if (text === want || text?.replace(/\s+/g, '-') === hash.toLowerCase()) {
                element = h
                break
              }
            }
          }
        }
        if (element) {
          scrollToElementWithOffset(element, SCROLL_OFFSET_PX, 'smooth')
          lastScrolledHashRef.current = hash
          applyAnchorHighlight(element, anchorHighlightClearRef.current)
        }
      })
    }

    window.addEventListener('hashchange', scrollToHash)
    cleanupRef.current = () => window.removeEventListener('hashchange', scrollToHash)

    return () => {
      cleanupRef.current?.()
    }
  }, [currentTranslation?.content, language])

  // 모바일: 이미지/비디오 확대 모달 열릴 때 스크롤 위치 고정 → 닫으면 원래 위치 복원
  useEffect(() => {
    const isOpen = !!expandedImage || !!expandedVideo
    if (!isOpen) {
      // 복원
      if (typeof window !== 'undefined') {
        const y = modalScrollYRef.current || 0
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, y)
      }
      return
    }
    if (typeof window === 'undefined') return
    const y = window.scrollY || window.pageYOffset || 0
    modalScrollYRef.current = y
    document.body.style.position = 'fixed'
    document.body.style.top = `-${y}px`
    document.body.style.width = '100%'
  }, [expandedImage, expandedVideo])

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

  if (isLoading || !project) {
    return <ProjectDetailSkeleton />
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
            key={`chapter-${projectId}-${language}`}
            content={currentTranslation.content || ''} 
            title={currentTranslation.title}
            onToggle={setIsChapterOpen}
            contentContainerRef={contentRef}
            collapseWhenNarrow={windowWidth > 0 && windowWidth < 744}
            contentReady={contentReady}
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
                          ) : field.type === 'note_warning' ? (
                            <div className="self-stretch pt-4 inline-flex flex-col justify-start items-start gap-2">
                              <div
                                className="w-full px-2 pt-2 pb-3 bg-black rounded-lg inline-flex justify-start items-center gap-2"
                                style={{
                                  outline: '1px solid rgb(250 204 21)',
                                  outlineOffset: -1,
                                }}
                              >
                                <div className="flex justify-start items-center gap-4">
                                  <div
                                    className="justify-start whitespace-pre-line"
                                    style={{
                                      color: 'rgb(250 204 21)',
                                      fontFamily: '"Pretendard Variable"',
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      lineHeight: '20px',
                                    }}
                                  >
                                    {field.value}
                                  </div>
                                </div>
                              </div>
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
                data-portfolio-body
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
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
              className="max-w-full max-h-[85vh] object-contain shadow-2xl"
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

