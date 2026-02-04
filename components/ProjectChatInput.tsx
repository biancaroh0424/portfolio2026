'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatBot } from '@/contexts/ChatBotContext'
import { usePathname } from 'next/navigation'

// Chip 컴포넌트 (Figma 디자인에 맞춘 스타일)
function ChipWithRemoveButton({ selectedTextChip, onRemove }: { selectedTextChip: string; onRemove: () => void }) {
  const [isHovered, setIsHovered] = useState(false)
  const clipId = `clip-${Math.random().toString(36).substring(2, 9)}`
  
  return (
    <div 
      style={{ 
        display: 'inline-flex',
        width: 'auto',
        maxWidth: '240px',
        alignSelf: 'flex-start',
        flexShrink: 0,
        padding: '8px',
        alignItems: 'center',
        gap: '6px',
        borderRadius: '8px',
        border: '1px solid rgba(131, 131, 131, 0.3)',
        background: 'rgba(58, 58, 58, 0.8)',
        cursor: 'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 아이콘 */}
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <g clipPath={`url(#${clipId})`}>
          <path d="M8.09375 0.875002H3.71875C3.42867 0.875002 3.15047 1.00406 2.94535 1.2338C2.74023 1.46353 2.625 1.77511 2.625 2.1V11.9C2.625 12.2249 2.74023 12.5365 2.94535 12.7662C3.15047 12.9959 3.42867 13.125 3.71875 13.125H10.2812C10.5713 13.125 10.8495 12.9959 11.0546 12.7662C11.2598 12.5365 11.375 12.2249 11.375 11.9V4.55M8.09375 0.875002C8.26686 0.874688 8.43833 0.912733 8.59826 0.986948C8.75819 1.06116 8.90343 1.17008 9.02562 1.30743L10.9878 3.50508C11.1108 3.64197 11.2083 3.8048 11.2748 3.98415C11.3412 4.1635 11.3753 4.35582 11.375 4.55M8.09375 0.875002V3.9375C8.09375 4.09995 8.15137 4.25574 8.25392 4.3706C8.35648 4.48547 8.49558 4.55 8.64062 4.55L11.375 4.55" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <defs>
          <clipPath id={clipId}>
            <rect width="14" height="14" fill="white"/>
          </clipPath>
        </defs>
      </svg>
      {/* 텍스트 */}
      <div
        style={{
          overflow: 'hidden',
          color: 'var(--text-primary, #FFF)',
          textOverflow: 'ellipsis',
          fontFamily: '"Pretendard Variable", sans-serif',
          fontSize: '13px',
          fontStyle: 'normal',
          fontWeight: 400,
          lineHeight: '160%',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {selectedTextChip}
      </div>
      <button
        onClick={onRemove}
        style={{ 
          flexShrink: 0,
          width: '24px',
          height: '24px',
          minWidth: '24px',
          minHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--button-iconOnlyHovered, rgba(255, 255, 255, 0.20))',
          border: 'none',
          borderRadius: '8px',
          cursor: isHovered ? 'pointer' : 'default',
          transition: 'opacity 0.2s',
          padding: 0,
          boxSizing: 'border-box',
          lineHeight: 0,
          opacity: isHovered ? 1 : 0,
          pointerEvents: isHovered ? 'auto' : 'none'
        }}
        aria-label="Remove chip"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 0.5L0.5 11M0.5 0.5L11 11" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

export default function ProjectChatInput() {
  const [inputVisible, setInputVisible] = useState(true)
  const lastScrollY = useRef(0)
  const [isFocused, setIsFocused] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [leftPosition, setLeftPosition] = useState('50%')
  const [isMobile, setIsMobile] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const isSendingRef = useRef(false) // 중복 전송 방지
  const { setChatInputSetter, chatInput, setChatInput, selectedTextChip, setSelectedTextChip, isOpen, openChatBot, sendMessage, width } = useChatBot()
  const pathname = usePathname()

  // 모바일 여부 확인
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 744)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Portfolio content div의 위치를 찾아서 중앙 정렬
  useEffect(() => {
    let animationFrameId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let intervalId: NodeJS.Timeout | null = null
    
    const updatePosition = () => {
      // portfolio content div 찾기 (max-w-[980px] 클래스 또는 max-width: 980px 스타일)
      const portfolioContent = document.querySelector('[class*="max-w-[980px]"], [style*="max-width: 980px"]') as HTMLElement
      if (portfolioContent) {
        const rect = portfolioContent.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        setLeftPosition(`${centerX}px`)
      }
    }

    // 즉시 실행
    updatePosition()
    
    // ResizeObserver로 portfolio content div의 크기 변경 감지
    const portfolioContent = document.querySelector('[class*="max-w-[980px]"], [style*="max-width: 980px"]') as HTMLElement
    if (portfolioContent && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updatePosition()
      })
      resizeObserver.observe(portfolioContent)
      // 부모 요소도 관찰 (margin 변경 감지)
      if (portfolioContent.parentElement) {
        resizeObserver.observe(portfolioContent.parentElement)
      }
    }
    
    // 빠른 주기로 위치 업데이트 (60fps = 16ms)
    intervalId = setInterval(() => {
      updatePosition()
    }, 16)
    
    // window resize 이벤트 - 즉시 반응
    const handleResize = () => {
      updatePosition()
    }
    
    window.addEventListener('resize', handleResize, { passive: true })
    window.addEventListener('scroll', updatePosition, { passive: true })

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (intervalId) clearInterval(intervalId)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [pathname, width, isOpen])

  // 스크롤 방향 감지 — nav와 반대: scroll down → 표시, scroll up → 숨김
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      if (y <= 60) {
        setInputVisible(true)
      } else if (y > lastScrollY.current) {
        setInputVisible(true)
      } else {
        setInputVisible(false)
      }
      lastScrollY.current = y
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])


  // Context에 setInput 함수 등록 (하위 호환성)
  useEffect(() => {
    if (setChatInputSetter) {
      const inputSetter = (text: string) => {
        if (text) {
          setChatInput(text)
          setTimeout(() => {
            inputRef.current?.focus()
            // 높이 조절
            if (inputRef.current) {
              inputRef.current.style.height = 'auto'
              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
            }
          }, 100)
        }
      }
      setChatInputSetter(inputSetter)
      
      return () => {
        if (setChatInputSetter) {
          setChatInputSetter(() => {})
        }
      }
    }
  }, [setChatInputSetter, setChatInput])

  // input 값이 변경될 때 높이 조절
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [chatInput])

  // Placeholder 스타일 적용
  useEffect(() => {
    const styleId = 'project-chat-input-placeholder-style'
    if (document.getElementById(styleId)) return
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      #project-chat-input-container textarea::placeholder {
        color: var(--text-placeholder, #B3B3B3);
        font-family: "Pretendard Variable", sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 160%;
        text-align: left;
      }
      #project-chat-input-container textarea:not(:placeholder-shown)::placeholder {
        text-align: left;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  const handleStop = () => {
    setIsLoading(false)
    // TODO: 실제 스트림 중단 로직 추가 필요
  }

  const handleSend = async () => {
    // 중복 전송 방지
    if (isSendingRef.current || isLoading) return
    
    const userMessage = (chatInput || '').trim()
    if (!userMessage) return

    // 전송 시작 표시
    isSendingRef.current = true
    setChatInput('')
    // textarea 높이 초기화
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    // 챗봇이 닫혀있으면 열기
    if (!isOpen) {
      openChatBot()
      // 챗봇이 열릴 때까지 약간의 지연 후 메시지 전송
      setTimeout(() => {
        if (sendMessage) {
          // userMessage만 전송하고, selectedTextChip은 ChatBot에서 처리하도록 함
          sendMessage(userMessage)
        }
        setIsLoading(false)
        isSendingRef.current = false
      }, 300)
    } else {
      // 챗봇이 이미 열려있으면 바로 메시지 전송
      if (sendMessage) {
        // userMessage만 전송하고, selectedTextChip은 ChatBot에서 처리하도록 함
        sendMessage(userMessage)
      }
      setIsLoading(false)
      isSendingRef.current = false
    }
    
    // chip 제거는 ChatBot의 handleSend에서 처리하도록 함 (메시지 전송 후)
  }

  if (isOpen) return null

  // 숨길 때 화면 아래로 완전히 치우기: 100% + bottom(24px) + 여유
  const translateHidden = 'translateY(calc(100% + 48px))'
  const transformVisible = isMobile
    ? (inputVisible ? 'translateY(0)' : translateHidden)
    : (inputVisible ? 'translateX(-50%) translateY(0)' : `translateX(-50%) ${translateHidden}`)

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: isMobile ? '0' : leftPosition,
        transform: transformVisible,
        zIndex: 1000,
        width: '100%',
        maxWidth: '980px',
        padding: isMobile ? '0 16px' : '0 24px',
        pointerEvents: inputVisible ? 'auto' : 'none',
        display: 'flex',
        justifyContent: 'center',
        transition: 'transform 0.3s ease-out'
      }}
    >
      <div
        ref={containerRef}
        data-no-text-selection="true"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          alignSelf: 'stretch',
          width: isMobile ? '100%' : '380px',
          maxWidth: '100%',
          transition: 'all 0.15s ease'
        }}
      >
        {/* Input Container with rounded capsule design */}
        <div 
          ref={inputContainerRef}
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: '8px',
            alignSelf: 'stretch',
            borderRadius: '24px',
            border: isFocused ? '1px solid var(--orange-400, #DB6930)' : '1px solid transparent',
            background: 'var(--GreyScale-700, #222424)',
            padding: selectedTextChip ? '8px 8px 8px 16px' : '8px 8px 8px 16px',
            width: '100%',
            transition: 'border-color 0.15s ease, width 0.15s ease'
          }}
        >
          {/* Selected Text Chip - inside container */}
          {selectedTextChip && (
            <div style={{ alignSelf: 'flex-start' }}>
              <ChipWithRemoveButton 
                selectedTextChip={selectedTextChip} 
                onRemove={() => setSelectedTextChip?.(null)} 
              />
            </div>
          )}
          
          {/* Input and Send Button Row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            width: '100%'
          }}>
          <div 
            id="project-chat-input-container"
            style={{ 
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'left',
              minHeight: '40px',
              transition: 'all 0.15s ease',
              backgroundColor: 'transparent'
            }}
          >
            <textarea
              ref={inputRef}
              value={chatInput || ''}
              onChange={(e) => {
                const nextValue = e.target.value || ''
                setChatInput(nextValue)
                // 자동 높이 조절
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto'
                  inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
                }
              }}
              onKeyDown={(e) => {
                // Enter: 전송 (Shift가 눌리지 않은 경우)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!isLoading) {
                    handleSend()
                  }
                }
                // Shift+Enter: 줄바꿈 (기본 동작 허용)
                // Command+Enter 또는 Ctrl+Enter: 전송
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (!isLoading) {
                    handleSend()
                  }
                }
              }}
              placeholder="YJ AI Assistant 에게 물어보기"
              onFocus={() => {
                setIsFocused(true)
                if (containerRef.current && !isMobile) {
                  containerRef.current.style.width = '440px'
                }
              }}
              onBlur={() => {
                setIsFocused(false)
                if (containerRef.current && !isMobile) {
                  containerRef.current.style.width = '380px'
                }
              }}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary, #FFF)',
                fontFamily: '"Pretendard Variable", sans-serif',
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: '160%',
                resize: 'none',
                overflow: 'auto',
                minHeight: '24px',
                maxHeight: '200px',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                padding: '8px 0',
                margin: 0
              }}
              rows={1}
            />
          </div>
          
          {/* Send Button - Circular with upward arrow */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              style={{
                display: 'flex',
                width: '40px',
                height: '40px',
                padding: 0,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '50%',
                background: 'var(--red-500, #ef4444)',
                color: 'var(--text-primary, #FFF)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--red-600, #dc2626)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--red-500, #ef4444)'
              }}
              aria-label="Stop"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="8" height="8" fill="currentColor" rx="1"/>
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!chatInput?.trim()}
              style={{
                display: 'flex',
                width: '40px',
                height: '40px',
                padding: 0,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '50%',
                background: chatInput?.trim() ? 'var(--orange-400, #DB6930)' : 'var(--orange-800, #662707)',
                color: 'var(--text-primary, #FFF)',
                border: 'none',
                cursor: chatInput?.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                opacity: chatInput?.trim() ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (chatInput?.trim()) {
                  e.currentTarget.style.opacity = '0.9'
                }
              }}
              onMouseLeave={(e) => {
                if (chatInput?.trim()) {
                  e.currentTarget.style.opacity = '1'
                }
              }}
              aria-label="Send"
            >
              {/* Upward arrow icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <g clipPath="url(#clip0_504_3351)">
                  <path d="M8 15L8 1M8 1L1 8M8 1L15 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                <defs>
                  <clipPath id="clip0_504_3351">
                    <rect width="16" height="16" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
