'use client'

import {
  createContext,
  useContext,
  useState,
  useLayoutEffect,
  useCallback,
  ReactNode,
  ReactElement,
} from 'react'

export type Language = 'en' | 'ko' | 'it'

type LanguageContextType = {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  renderText: (key: string) => ReactElement
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// 번역 데이터
const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.project': 'Portfolio',
    'nav.resume': 'Resumé',
    'nav.admin': 'Admin',
    'nav.aiAssistant': 'AI Assistant',
    'nav.contact': 'Contact',
    'nav.language.english': 'ENGLISH',
    'nav.language.korean': '한국어',
    'nav.language.italian': 'ITALIANO',
    'nav.resume.noResume': 'No resume available',
    'home.title': 'Designing Intuitive,\nHuman-centered Experiences',
    'home.description': 'Hi, I\'m YoungJoo Roh - a product designer who turns data into intuitive experiences. Ask me anything about my work.',
    'home.button.projects': 'Go to Portfolio',
    'home.button.aiAssistant': 'AI Assistant',
    'chatbot.greeting': 'Hey there! 👋\n\nI\'m YJ Assistant—built with vibe coding.\n\nI\'m here to help you get a quick read on Youngjoo Roh\'s design work and the impact behind it.\n\nWhat would you like to know? 😄',
    'chatbot.placeholder': 'Ask about what Youngjoo Roh has worked on',
    'chatbot.projectPlaceholder': 'Ask YJ AI Assistant about this project',
    'chatbot.tooltip.collapse': 'Collapse',
    'chatbot.tooltip.chatHistory': 'Chat History',
    'chatbot.tooltip.newChat': 'New Chat',
    'chatbot.tooltip.close': 'Close',
    'chatbot.tooltip.edit': 'Edit',
    'chatbot.tooltip.copy': 'Copy',
    'chatbot.tooltip.copied': 'Copied',
    'chatbot.noChatHistory': 'No chat history',
  },
  ko: {
    'nav.project': '포트폴리오',
    'nav.resume': '이력서',
    'nav.admin': '관리자',
    'nav.aiAssistant': 'AI 어시스턴트',
    'nav.contact': '연락하기',
    'nav.language.english': '영어',
    'nav.language.korean': '한국어',
    'nav.language.italian': '이탈리아어',
    'nav.resume.noResume': '사용 가능한 이력서가 없습니다',
    'home.title': 'Designing Intuitive,\nHuman-centered Experiences',
    'home.description': '데이터를 직관적인 경험으로 전환하는\n프로덕트 메이커 노영주입니다. \n진행한 프로젝트에 대해 무엇이든 물어보세요!',
    'home.button.projects': '포트폴리오 보기',
    'home.button.aiAssistant': 'AI 어시스턴트',
    'chatbot.greeting': '안녕하세요!👋\n\n저는 바이브 코딩으로 만들어진 YJ Assistant예요. \n\n노영주님의 디자인 작업과 측정 가능한 성과를 빠르게 이해할 수 있도록 도와릴게요!\n\n무엇이 궁금하신가요? 😄',
    'chatbot.placeholder': '노영주가 어떤 것을 작업했는지 물어보세요',
    'chatbot.projectPlaceholder': 'YJ Assistant에게 프로젝트를 물어보세요',
    'chatbot.tooltip.collapse': '접기',
    'chatbot.tooltip.chatHistory': '채팅 기록',
    'chatbot.tooltip.newChat': '새 채팅',
    'chatbot.tooltip.close': '닫기',
    'chatbot.tooltip.edit': '수정',
    'chatbot.tooltip.copy': '복사',
    'chatbot.tooltip.copied': '복사됨',
    'chatbot.noChatHistory': '대화 기록이 없습니다',
  },
  it: {
    'nav.project': 'Portfolio',
    'nav.resume': 'Curriculum',
    'nav.admin': 'Admin',
    'nav.aiAssistant': 'Assistente AI',
    'nav.contact': 'Contatto',
    'nav.language.english': 'ENGLISH',
    'nav.language.korean': '한국어',
    'nav.language.italian': 'ITALIANO',
    'nav.resume.noResume': 'Nessun curriculum disponibile',
    'home.title': 'Progettare Esperienze\nIntuitive e Centrate sull\'Uomo',
    'home.description': 'Ciao, sono YoungJoo Roh - una product designer che trasforma i dati in esperienze intuitive. Chiedimi qualsiasi cosa sul mio lavoro.',
    'home.button.projects': 'Vai al Portfolio',
    'home.button.aiAssistant': 'Assistente AI',
    'chatbot.greeting': 'Ciao! 👋\n\nSono YJ Assistant, realizzato con il vibe coding.\n\nTi aiuto a capire in fretta il lavoro di design di Youngjoo Roh e i risultati concreti.\n\nCosa ti piacerebbe sapere? 😄',
    'chatbot.placeholder': 'Chiedimi cosa ha realizzato Youngjoo Roh',
    'chatbot.projectPlaceholder': 'Chiedi all\'assistente AI del progetto',
    'chatbot.tooltip.collapse': 'Riduci',
    'chatbot.tooltip.chatHistory': 'Cronologia chat',
    'chatbot.tooltip.newChat': 'Nuova chat',
    'chatbot.tooltip.close': 'Chiudi',
    'chatbot.tooltip.edit': 'Modifica',
    'chatbot.tooltip.copy': 'Copia',
    'chatbot.tooltip.copied': 'Copiato',
    'chatbot.noChatHistory': 'Nessuna cronologia chat',
  },
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 첫 렌더 때부터 브라우저 언어를 반영해서(ko-first) 깜빡임을 최소화
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ko'
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en'
    return browserLang.startsWith('it') ? 'it' : 'ko'
  })

  // 첫 페인트 전에 언어 복원(영어 UI 비활성화 시 en 저장값 → ko 정규화)으로 깜빡임 최소화
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    
  // "Korean-first": 브라우저 언어가 이탈리아어가 아니면 UI는 무조건 한국어로 진입
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en'
    const nextLang: Language = browserLang.startsWith('it') ? 'it' : 'ko'
    localStorage.setItem('language', nextLang)
    setLanguageState(nextLang)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    const normalized: Language = lang === 'en' ? 'ko' : lang
    setLanguageState(normalized)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', normalized)
    }
  }, [])

  const t = (key: string): string => {
    return translations[language]?.[key] || key
  }

  const renderText = (key: string): ReactElement => {
    const text = t(key)
    const lines = text.split('\n')
    return (
      <>
        {lines.map((line, index, array) => (
          <span key={index}>
            {line}
            {index < array.length - 1 && <br />}
          </span>
        ))}
      </>
    )
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, renderText }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
