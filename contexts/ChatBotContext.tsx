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
  // 포트폴리오는 전용 키 사용, 없으면 기본 열림 / 그 외는 기본 닫힘
  useEffect(() => {
    if (!hasLoadedFromStorage.current && typeof window !== 'undefined' && pathname != null) {
      try {
        // width 불러오기
        const savedWidth = localStorage.getItem(CHATBOT_WIDTH_KEY)
        if (savedWidth) {
          const parsed = parseInt(savedWidth, 10)
          if (!isNaN(parsed) && parsed >= 320 && parsed <= 620) {
            setWidth(parsed)
          }
        }
        
        const isPortfolio = pathname.startsWith('/portfolio')
        const storageKey = isPortfolio ? CHATBOT_IS_OPEN_PORTFOLIO_KEY : CHATBOT_IS_OPEN_KEY
        const savedIsOpen = localStorage.getItem(storageKey)
        if (savedIsOpen !== null) {
          setIsOpen(savedIsOpen === 'true')
        } else {
          setIsOpen(isPortfolio) // 포트폴리오: 기본 열림, 그 외: 기본 닫힘
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

  // isOpen 상태 변경 시 현재 경로에 맞는 키로 저장 (포트폴리오 전용 키 / 그 외 공통 키)
  useEffect(() => {
    if (hasLoadedFromStorage.current && typeof window !== 'undefined' && pathname != null) {
      try {
        const key = pathname.startsWith('/portfolio') ? CHATBOT_IS_OPEN_PORTFOLIO_KEY : CHATBOT_IS_OPEN_KEY
        localStorage.setItem(key, isOpen.toString())
      } catch (e) {
        console.warn('Failed to save chatbot isOpen state to storage:', e)
      }
    }
  }, [isOpen, pathname])

  // 경로 변경 시 해당 구역 저장값으로 동기화 (포트폴리오 진입 시 기본 열림, 상세↔리스트 동기화)
  useEffect(() => {
    if (!hasLoadedFromStorage.current || typeof window === 'undefined' || pathname == null) return
    try {
      const isPortfolio = pathname.startsWith('/portfolio')
      const key = isPortfolio ? CHATBOT_IS_OPEN_PORTFOLIO_KEY : CHATBOT_IS_OPEN_KEY
      const savedIsOpen = localStorage.getItem(key)
      if (savedIsOpen !== null) {
        setIsOpen(savedIsOpen === 'true')
      } else {
        setIsOpen(isPortfolio) // 포트폴리오: 저장값 없으면 열림, 그 외: 닫힘
      }
    } catch {
      // 무시
    }
  }, [pathname])

  const toggleChatBot = () => {
    setIsOpen(prev => !prev)
  }

  const openChatBot = () => {
    setIsOpen(true)
  }

  const closeChatBot = () => {
    setIsOpen(false)
  }

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

