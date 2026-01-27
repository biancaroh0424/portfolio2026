'use client'

import { useEffect, useState, useRef } from 'react'

interface Chapter {
  id: string
  text: string
  level: number
}

interface ChapterStatusProps {
  content: string
  title?: string
  onToggle?: (isOpen: boolean) => void
}

export default function ChapterStatus({ content, title, onToggle }: ChapterStatusProps) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [activeChapter, setActiveChapter] = useState<string | null>(null)
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(true)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isScrollingRef = useRef(false)

  // HTML 콘텐츠에서 헤딩 추출 (h2~h6만)
  useEffect(() => {
    if (!content) return

    const timer = setTimeout(() => {
      // h2~h5만 추출 (h1, h6 제외)
      const headings = document.querySelectorAll('.prose h2, .prose h3, .prose h4, .prose h5, .prose-lg h2, .prose-lg h3, .prose-lg h4, .prose-lg h5')
      const chaptersList: Chapter[] = []

      headings.forEach((heading) => {
        const id = heading.id
        const text = heading.textContent?.trim() || ''
        const tagName = heading.tagName.toLowerCase()
        const level = parseInt(tagName.replace('h', ''), 10)

        // h2~h5만 포함 (level 2~5, h6 제외) 및 ID가 있는 경우만 추가
        // ID는 프로젝트 상세 페이지에서 생성되므로, ID가 없으면 아직 생성되지 않은 것으로 간주
        if (text && level >= 2 && level <= 5 && id && id !== '-' && !/^-+$/.test(id)) {
          chaptersList.push({ id, text, level })
        }
      })

      setChapters(chaptersList)
    }, 600) // 프로젝트 상세 페이지의 ID 생성(100ms) 이후에 실행되도록 충분히 지연

    return () => clearTimeout(timer)
  }, [content])

  // 스크롤 위치에 따라 활성 챕터 업데이트
  useEffect(() => {
    if (chapters.length === 0) return

    const handleScroll = () => {
      // 상단 네비게이션 높이(80px) + 여유 공간(20px)을 고려한 offset
      const offset = 100
      const scrollPosition = window.scrollY + offset

      // 모든 챕터의 위치를 확인
      const chapterPositions = chapters.map((chapter) => {
        const element = document.getElementById(chapter.id)
        if (element) {
          return {
            id: chapter.id,
            top: element.getBoundingClientRect().top + window.scrollY,
          }
        }
        return null
      }).filter(Boolean) as Array<{ id: string; top: number }>

      if (chapterPositions.length === 0) return

      let activeId: string | null = null

      // 첫 번째 챕터 위에 있으면 첫 번째 챕터를 active로
      if (chapterPositions.length > 0) {
        const firstChapter = chapterPositions[0]
        if (scrollPosition < firstChapter.top) {
          // 첫 번째 챕터 위에 있으면 첫 번째 챕터를 active로
          activeId = firstChapter.id
        } else {
          // 역순으로 확인하여 가장 위에 있는 챕터를 찾음 (스크롤 업/다운 모두 작동)
          for (let i = chapterPositions.length - 1; i >= 0; i--) {
            const currentChapter = chapterPositions[i]
            const nextChapter = chapterPositions[i + 1]

            // 현재 챕터의 시작 위치
            const chapterStart = currentChapter.top

            // 다음 챕터가 있으면 그 위치까지, 없으면 페이지 끝까지
            const chapterEnd = nextChapter ? nextChapter.top : Infinity

            // 스크롤 위치가 현재 챕터 영역에 있으면 active
            if (scrollPosition >= chapterStart && scrollPosition < chapterEnd) {
              activeId = currentChapter.id
              break
            }
          }
        }
      }

      // active 상태 업데이트
      setActiveChapter(activeId)
    }

    // 스크롤 이벤트 리스너 (throttle 적용)
    let ticking = false
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', throttledHandleScroll, { passive: true })
    handleScroll() // 초기 실행

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll)
      // 타이머 정리
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
    }
  }, [chapters])

  const handleChapterClick = (chapterId: string) => {
    // 이전 스크롤 타이머 취소 (제목 클릭 포함)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = null
    }
    
    // 스크롤 중 플래그 초기화
    isScrollingRef.current = false
    
    // 즉시 active 상태로 설정
    setActiveChapter(chapterId)
    
    // 기존 스크롤 중단 (중복 스크롤 방지)
    window.scrollTo({
      top: window.scrollY,
      behavior: 'auto'
    })
    
    // 스크롤 중 플래그 설정
    isScrollingRef.current = true
    
    // 요소를 찾아서 스크롤
    const scrollToElement = (retries = 10) => {
      // 먼저 ID로 찾기
      let element = document.getElementById(chapterId)
      
      // ID로 찾지 못하면 챕터 텍스트로 찾기
      if (!element) {
        const chapter = chapters.find(c => c.id === chapterId)
        if (chapter) {
          const headings = document.querySelectorAll('.prose h2, .prose h3, .prose h4, .prose h5, .prose h6, .prose-lg h2, .prose-lg h3, .prose-lg h4, .prose-lg h5, .prose-lg h6')
          headings.forEach((heading) => {
            if (heading.textContent?.trim() === chapter.text) {
              element = heading as HTMLElement
              // ID가 없으면 설정
              if (!element.id) {
                element.id = chapterId
              }
            }
          })
        }
      }
      
      if (!element) {
        if (retries > 0) {
          // 요소를 찾지 못했으면 재시도
          scrollTimeoutRef.current = setTimeout(() => scrollToElement(retries - 1), 50)
          return
        }
        console.warn(`Chapter element with id "${chapterId}" not found`)
        isScrollingRef.current = false
        return
      }
      
      // 상단 네비게이션 높이(80px)를 고려한 offset
      const offset = 80
      
      // URL hash 업데이트 (스크롤 전에)
      window.location.hash = chapterId

      // 요소의 절대 위치 계산
      const rect = element.getBoundingClientRect()
      const elementTop = rect.top + window.scrollY
      const offsetPosition = Math.max(0, elementTop - offset)

      // 스크롤 실행 - 더 확실하게 작동하도록 여러 번 시도
      const performScroll = () => {
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        })
        
        // 스크롤이 제대로 되었는지 확인하고 재시도
        setTimeout(() => {
          const currentScroll = window.scrollY
          const targetScroll = offsetPosition
          const diff = Math.abs(currentScroll - targetScroll)
          
          // 10px 이상 차이가 나면 재시도
          if (diff > 10) {
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            })
          }
        }, 300)
      }
      
      performScroll()
      
      // 스크롤 완료 후 플래그 해제 (약 1초 후)
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false
        scrollTimeoutRef.current = null
      }, 1000)
    }
    
    // 약간의 지연 후 실행 (DOM 업데이트 대기)
    scrollTimeoutRef.current = setTimeout(() => scrollToElement(), 50)
  }

  // title이나 chapters가 있으면 렌더링 (초기 로딩 중이어도 title이 있으면 보여줌)
  // if (chapters.length === 0 && !title) return null

  return (
    <div
      className="chapter-status-container"
      style={{
        width: isOpen ? '260px' : '40px',
        flexShrink: 0,
        transition: 'width 0.3s ease-in-out',
      }}
    >
      {/* 접혔을 때 보이는 햄버거 아이콘 */}
      {!isOpen && title && (
        <div
          className="fixed left-0 top-0 bottom-0 z-30"
          data-no-text-selection="true"
          style={{
            width: '40px',
            paddingTop: '80px',
            paddingLeft: '12px',
          }}
        >
          <div
            onClick={() => {
              const newIsOpen = true
              setIsOpen(newIsOpen)
              onToggle?.(newIsOpen)
            }}
            style={{
              padding: '4px 0px 12px 0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {/* Hamburger Menu Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 1V6.6L8.75 4.5L11 6.6V1M2 13.25V2.75C2 2.28587 2.19754 1.84075 2.54917 1.51256C2.90081 1.18437 3.37772 1 3.875 1H13.25C13.4489 1 13.6397 1.07375 13.7803 1.20503C13.921 1.3363 14 1.51435 14 1.7V14.3C14 14.4857 13.921 14.6637 13.7803 14.795C13.6397 14.9263 13.4489 15 13.25 15H3.875C3.37772 15 2.90081 14.8156 2.54917 14.4874C2.19754 14.1592 2 13.7141 2 13.25ZM2 13.25C2 12.7859 2.19754 12.3408 2.54917 12.0126C2.90081 11.6844 3.37772 11.5 3.875 11.5H14" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}

      {/* 사이드바 메인 컨테이너 */}
      <div 
        className="sticky top-[80px] left-0 z-30 transition-transform duration-300 ease-in-out self-start" 
        data-no-text-selection="true"
        style={{ 
          width: '260px',
          paddingTop: '0',
          paddingLeft: '16px',
          paddingRight: '16px',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto'
        }}
      >
        <div className="overflow-y-auto">
          <div className="space-y-0">
            {/* Portfolio Title Chapter */}
            {title && (
              <div
                onClick={() => {
                  const newIsOpen = !isOpen
                  setIsOpen(newIsOpen)
                  onToggle?.(newIsOpen)
                }}
                style={{
                  padding: '4px 0px 12px 0px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                }}
              >
                {/* Hamburger Menu Icon */}
                <div
                  style={{
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6.5 1V6.6L8.75 4.5L11 6.6V1M2 13.25V2.75C2 2.28587 2.19754 1.84075 2.54917 1.51256C2.90081 1.18437 3.37772 1 3.875 1H13.25C13.4489 1 13.6397 1.07375 13.7803 1.20503C13.921 1.3363 14 1.51435 14 1.7V14.3C14 14.4857 13.921 14.6637 13.7803 14.795C13.6397 14.9263 13.4489 15 13.25 15H3.875C3.37772 15 2.90081 14.8156 2.54917 14.4874C2.19754 14.1592 2 13.7141 2 13.25ZM2 13.25C2 12.7859 2.19754 12.3408 2.54917 12.0126C2.90081 11.6844 3.37772 11.5 3.875 11.5H14" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                
                {/* Title Text */}
                <span
                  style={{
                    color: '#FFFFFF',
                    fontFamily: 'galmuri, monospace',
                    fontSize: '12px',
                    fontWeight: 400,
                    lineHeight: 'normal',
                    flex: 1,
                  }}
                >
                  {title}
                </span>
              </div>
            )}
          
          {chapters.length > 0 && chapters.map((chapter) => {
            const isActive = activeChapter === chapter.id
            const isHovered = hoveredChapter === chapter.id
            
            // 레벨별 padding 설정 (h6 제외)
            const getPadding = (level: number) => {
              switch (level) {
                case 2: return '4px 0 8px 16px'
                case 3: return '4px 0 4px 24px'
                case 4: return '4px 0 8px 32px'
                case 5: return '4px 0 8px 40px'
                default: return '4px 0 8px 16px'
              }
            }
            
            return (
              <button
                key={chapter.id}
                onClick={() => handleChapterClick(chapter.id)}
                onMouseEnter={() => setHoveredChapter(chapter.id)}
                onMouseLeave={() => setHoveredChapter(null)}
                className="relative"
                style={{
                  display: 'flex',
                  width: '100%',
                  padding: getPadding(chapter.level),
                  alignItems: 'flex-start',
                  gap: '15px',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderLeft: `1px solid ${
                    isActive 
                      ? '#c2490d' // orange-500
                      : isHovered 
                        ? 'var(--greyscale-200)' // 흰색
                        : 'var(--greyscale-400)' // 기본 회색
                  }`,
                  color: isActive 
                    ? 'var(--text-primary)' 
                    : isHovered 
                      ? 'var(--text-hovered)' 
                      : 'var(--text-primaryInactive)',
                  fontFamily: 'galmuri, monospace',
                  fontSize: '12px',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  lineHeight: 'normal',
                  transition: '0.2s',
                  textAlign: 'left',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {/* 텍스트 */}
                <span
                  style={{
                    flex: 1,
                  }}
                >
                  {chapter.text}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}
