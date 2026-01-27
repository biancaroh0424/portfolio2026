'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { ChatBotProvider, useChatBot } from '@/contexts/ChatBotContext'
import ChatBotSidebar from '@/components/ChatBotSidebar'
import TextSelectionButton from '@/components/TextSelectionButton'
import { usePathname } from 'next/navigation'

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isOpen, width, toggleChatBot } = useChatBot()
  const [isMobile, setIsMobile] = useState(false)
  // 메인 페이지(/, /home)는 제외
  const isMainPage = pathname === '/' || pathname === '/home'

  // 모바일 여부 확인 (744px 미만)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 744)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Command+I (Mac) 또는 Ctrl+I (Windows/Linux)로 챗봇 토글
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command+I (Mac) 또는 Ctrl+I (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        toggleChatBot()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [toggleChatBot])
  
  return (
    <div className="min-h-screen relative">
      {/* Navigation과 메인 콘텐츠를 함께 감싸서 마진 적용 */}
      <div 
        className="transition-all duration-300 ease-in-out"
        style={{
          marginRight: isOpen && !isMainPage && !isMobile ? `${width}px` : '0'
        }}
      >
        {/* Navigation - fixed로 변경됨 */}
        <Navigation />
        
        {/* 메인 콘텐츠 */}
        <div>
          {children}
        </div>
        <Footer />
      </div>
      
      {/* 챗봇 사이드바 - 메인 페이지 제외, 화면 전체 높이 */}
      {!isMainPage && <ChatBotSidebar />}
      
      {/* 텍스트 선택 버튼 */}
      {!isMainPage && <TextSelectionButton />}
    </div>
  )
}

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ChatBotProvider>
      <LayoutContent>{children}</LayoutContent>
    </ChatBotProvider>
  )
}

