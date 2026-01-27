'use client'

import { useChatBot } from '@/contexts/ChatBotContext'
import ChatBot from './ChatBot'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function ChatBotSidebar() {
  const { isOpen, width, setWidth } = useChatBot()
  const pathname = usePathname()
  const [isResizing, setIsResizing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  
  // 포트폴리오 상세 페이지인지 확인
  const projectIdMatch = pathname?.match(/\/portfolio\/([^\/]+)/)
  const projectId = projectIdMatch ? projectIdMatch[1] : undefined

  // 모바일 여부 확인 (744px 미만)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 744)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = window.innerWidth - e.clientX
      const minWidth = 320
      const maxWidth = 620
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
      } else if (newWidth < minWidth) {
        setWidth(minWidth)
      } else if (newWidth > maxWidth) {
        setWidth(maxWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, setWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  return (
    <>
      {/* 챗봇 사이드바 - 화면 상단부터 끝까지 */}
      <div
        className={`fixed right-0 top-0 bottom-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        data-no-text-selection="true"
        style={{ 
          width: isMobile ? '100%' : `${width}px`,
          left: isMobile ? '0' : 'auto',
          minWidth: isMobile ? '100%' : '320px',
          maxWidth: isMobile ? '100%' : '620px',
          zIndex: isMobile ? 2500 : 40
        }}
      >
        {/* Resize 핸들 - 모바일에서는 숨김 */}
        {!isMobile && (
          <div
            ref={resizeRef}
            onMouseDown={handleMouseDown}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-gray-400 transition-colors z-50"
            style={{
              backgroundColor: isResizing ? 'rgba(156, 163, 175, 0.5)' : 'transparent'
            }}
          />
        )}
        
        <div className="h-full flex flex-col" style={{ 
          backgroundColor: 'var(--greyscale-700)',
          border: '1px solid var(--fill-white-10)' }}>
          {/* 챗봇 영역 */}
          <div className="flex-1 overflow-hidden">
            <ChatBot 
              projectId={projectId} 
              autoSummarize={false}
            />
          </div>
        </div>
      </div>
    </>
  )
}

