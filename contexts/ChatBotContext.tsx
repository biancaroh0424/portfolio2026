'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

interface ChatBotContextType {
  isOpen: boolean
  toggleChatBot: () => void
  openChatBot: () => void
  closeChatBot: () => void
  width: number
  setWidth: (width: number) => void
  chatInput: string
  setChatInput: (text: string) => void
  setChatInputSetter?: (setter: (text: string) => void) => void
  selectedTextChip?: string | null
  setSelectedTextChip?: (text: string | null) => void
  sendMessage?: (message: string) => void
  setSendMessage?: (sendFn: (message: string) => void) => void
}

const ChatBotContext = createContext<ChatBotContextType | undefined>(undefined)

const CHATBOT_WIDTH_KEY = 'chatbot-width'
const CHATBOT_IS_OPEN_KEY = 'chatbot-is-open'
const CHATBOT_IS_OPEN_PORTFOLIO_KEY = 'chatbot-is-open-portfolio'
/** 유저가 닫기 누르면 true. 어느 페이지에서든 유저가 열 때까지 닫혀 있음 */
const CHATBOT_CLOSED_BY_USER_KEY = 'chatbot-closed-by-user'
const MOBILE_MAX_WIDTH = 743 // 이하면 모바일 → 에이전트 자동 열기 안 함

export function ChatBotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // SSR과 클라이언트 간 hydration mismatch 방지를 위해 초기값은 항상 false
  const [isOpen, setIsOpen] = useState(false)
  // SSR과 클라이언트 간 hydration mismatch 방지를 위해 초기값은 항상 320
  const [width, setWidth] = useState(320)
  const [chatInput, setChatInputState] = useState('')
  const [selectedTextChip, setSelectedTextChip] = useState<string | null>(null)
  const chatInputSetterRef = useRef<((text: string) => void) | undefined>(undefined)
  const sendMessageRef = useRef<((message: string) => void) | undefined>(undefined)
  const hasLoadedFromStorage = useRef(false)

  // 클라이언트에서만 localStorage에서 값 불러오기 (pathname 준비된 뒤 한 번만)
  // 새로고침 시 "유저가 닫음" 플래그 초기화 → 포트폴리오에서 다시 열림
  useEffect(() => {
    if (!hasLoadedFromStorage.current && typeof window !== 'undefined' && pathname != null) {
      try {
        // 새로고침 = 풀 페이지 로드이므로 "유저가 닫음" 초기화 (이번 세션 내 라우팅에서만 유지)
        localStorage.setItem(CHATBOT_CLOSED_BY_USER_KEY, 'false')

        // width 불러오기
        const savedWidth = localStorage.getItem(CHATBOT_WIDTH_KEY)
        if (savedWidth) {
          const parsed = parseInt(savedWidth, 10)
          if (!isNaN(parsed) && parsed >= 320 && parsed <= 620) {
            setWidth(parsed)
          }
        }

        const closedByUser = localStorage.getItem(CHATBOT_CLOSED_BY_USER_KEY) === 'true'
        if (closedByUser) {
          setIsOpen(false)
        } else {
          const isPortfolio = pathname.startsWith('/portfolio') || pathname.includes('/portfolio')
          const isMobile = typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH
          setIsOpen(!!(isPortfolio && !isMobile))
        }
      } catch (e) {
        console.warn('Failed to load chatbot state from storage:', e)
      }
      hasLoadedFromStorage.current = true
    }
  }, [pathname])

  // setWidth를 래핑하여 항상 localStorage에 저장
  const setWidthWithStorage = useCallback((newWidth: number) => {
    setWidth(newWidth)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_WIDTH_KEY, newWidth.toString())
      } catch (e) {
        console.warn('Failed to save chatbot width to storage:', e)
      }
    }
  }, [])

  // 열림 상태가 되면 "유저가 닫음" 플래그 해제 (경로 sync로 열렸을 때도)
  useEffect(() => {
    if (typeof window !== 'undefined' && isOpen) {
      try {
        localStorage.setItem(CHATBOT_CLOSED_BY_USER_KEY, 'false')
      } catch (e) {
        console.warn('Failed to save chatbot state to storage:', e)
      }
    }
  }, [isOpen])

  // pathname 변경 시: 유저가 닫아둔 상태면 항상 닫힘, 아니면 포트폴리오만 열림
  useEffect(() => {
    if (typeof window === 'undefined' || pathname == null) return
    try {
      const closedByUser = localStorage.getItem(CHATBOT_CLOSED_BY_USER_KEY) === 'true'
      if (closedByUser) {
        setIsOpen(false)
        return
      }
      const isPortfolio = pathname.startsWith('/portfolio') || pathname.includes('/portfolio')
      const isMobile = window.innerWidth <= MOBILE_MAX_WIDTH
      setIsOpen(!!(isPortfolio && !isMobile))
    } catch {
      // 무시
    }
  }, [pathname])

  const toggleChatBot = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CHATBOT_CLOSED_BY_USER_KEY, next ? 'false' : 'true')
        } catch {}
      }
      return next
    })
  }, [])

  const openChatBot = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_CLOSED_BY_USER_KEY, 'false')
      } catch {}
    }
    setIsOpen(true)
  }, [])

  const closeChatBot = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_CLOSED_BY_USER_KEY, 'true')
      } catch {}
    }
    setIsOpen(false)
  }, [])

  const handleSetChatInput = useCallback((text: string) => {
    setChatInputState(text)
    // chatInputSetterRef는 더 이상 필요 없음 (Context state를 직접 사용)
    // 무한 루프 방지를 위해 제거
  }, [])

  // ChatBot이 아직 마운트/등록 전일 수 있으므로, ref 없으면 짧은 지연 후 재시도
  const sendMessage = useCallback((message: string) => {
    if (!message || !message.trim()) return
    const trySend = (attempt = 0) => {
      if (sendMessageRef.current) {
        sendMessageRef.current(message.trim())
        return
      }
      if (attempt < 8) {
        setTimeout(() => trySend(attempt + 1), 50)
      }
    }
    trySend(0)
  }, [])

  // setChatInputSetter를 안전하게 래핑 (ref 사용으로 렌더링 중 호출 방지)
  // useCallback으로 메모이제이션하여 무한 루프 방지
  const safeSetChatInputSetter = useCallback((setter: (text: string) => void) => {
    chatInputSetterRef.current = setter
  }, [])

  const setSendMessage = useCallback((sendFn: (message: string) => void) => {
    sendMessageRef.current = sendFn
  }, [])

  return (
    <ChatBotContext.Provider value={{ 
      isOpen, 
      toggleChatBot, 
      openChatBot, 
      closeChatBot, 
      width, 
      setWidth: setWidthWithStorage,
      chatInput,
      setChatInput: handleSetChatInput,
      setChatInputSetter: safeSetChatInputSetter,
      selectedTextChip,
      setSelectedTextChip,
      sendMessage,
      setSendMessage
    }}>
      {children}
    </ChatBotContext.Provider>
  )
}

export function useChatBot() {
  const context = useContext(ChatBotContext)
  if (context === undefined) {
    throw new Error('useChatBot must be used within a ChatBotProvider')
  }
  return context
}

