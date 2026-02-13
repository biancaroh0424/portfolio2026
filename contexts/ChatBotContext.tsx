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
  // default 닫힘. 유저가 열어둔 상태만 저장값으로 복원 (언어/경로 변경 시에도 유지)
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

        const savedIsOpen = localStorage.getItem(CHATBOT_IS_OPEN_KEY)
        setIsOpen(savedIsOpen === 'true')
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

  // isOpen 변경 시 localStorage에 저장 (언어/경로 변경 시에도 유지)
  useEffect(() => {
    if (hasLoadedFromStorage.current && typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_IS_OPEN_KEY, isOpen.toString())
      } catch (e) {
        console.warn('Failed to save chatbot state to storage:', e)
      }
    }
  }, [isOpen])

  const toggleChatBot = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(CHATBOT_IS_OPEN_KEY, next.toString())
        } catch {}
      }
      return next
    })
  }, [])

  const openChatBot = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_IS_OPEN_KEY, 'true')
      } catch {}
    }
    setIsOpen(true)
  }, [])

  const closeChatBot = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CHATBOT_IS_OPEN_KEY, 'false')
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

