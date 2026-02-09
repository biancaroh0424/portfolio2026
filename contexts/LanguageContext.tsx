'use client'

import { createContext, useContext, useState, useEffect, ReactNode, ReactElement } from 'react'

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
    'nav.aiAssistant': 'AI Assistant',
    'nav.contact': 'Contact',
    'nav.language.english': 'ENGLISH',
    'nav.language.korean': '한국어',
    'nav.language.italian': 'ITALIANO',
    'home.title': 'Designing Intuitive,\nHuman-centered Experiences',
    'home.description': 'Hi, I\'m YoungJoo Roh - a product designer who turns data into intuitive experiences. Ask me anything about my work.',
    'home.button.projects': 'Go to Portfolio',
    'home.button.aiAssistant': 'AI Assistant',
    'chatbot.greeting': 'Hey there! 👋\n\nI\'m YJ Assistant—built with vibe coding.\n\nI\'m here to help you get a quick read on Youngjoo Roh\'s design work and the impact behind it.\n\nWhat would you like to know? 😄',
    'chatbot.placeholder': 'Ask about what Youngjoo Roh has worked on',
    'chatbot.projectPlaceholder': 'Ask YJ AI Assistant about this project',
  },
  ko: {
    'nav.project': '포트폴리오',
    'nav.resume': '이력서',
    'nav.aiAssistant': 'AI 어시스턴트',
    'nav.contact': '연락하기',
    'nav.language.english': 'ENGLISH',
    'nav.language.korean': '한국어',
    'nav.language.italian': 'ITALIANO',
    'home.title': 'Designing Intuitive,\nHuman-centered Experiences',
    'home.description': '데이터를 직관적인 경험으로 전환하는\n프로덕트 디자이너 노영주입니다. \n진행한 프로젝트에 대해 무엇이는 물어보세요!',
    'home.button.projects': '포트폴리오 보기',
    'home.button.aiAssistant': 'AI 어시스턴트',
    'chatbot.greeting': '안녕하세요!👋\n\n저는 바이브 코딩으로 만들어진 YJ Assistant예요. \n\n노영주님의 디자인 작업과 측정 가능한 성과를 빠르게 이해할 수 있도록 도와릴게요!\n\n무엇이 궁금하신가요? 😄',
    'chatbot.placeholder': '노영주가 어떤 것을 작업했는지 물어보세요',
    'chatbot.projectPlaceholder': 'YJ AI Assistant에게 프로젝트를 물어보세요',
  },
  it: {
    'nav.project': 'Portfolio',
    'nav.resume': 'Curriculum',
    'nav.aiAssistant': 'Assistente AI',
    'nav.contact': 'Contatto',
    'nav.language.english': 'ENGLISH',
    'nav.language.korean': '한국어',
    'nav.language.italian': 'ITALIANO',
    'home.title': 'Progettare Esperienze\nIntuitive e Centrate sull\'Uomo',
    'home.description': 'Ciao, sono YoungJoo Roh - una product designer che trasforma i dati in esperienze intuitive. Chiedimi qualsiasi cosa sul mio lavoro.',
    'home.button.projects': 'Vai al Portfolio',
    'home.button.aiAssistant': 'Assistente AI',
    'chatbot.greeting': 'Ciao! 👋\n\nSono YJ Assistant, realizzato con il vibe coding.\n\nTi aiuto a capire in fretta il lavoro di design di Youngjoo Roh e i risultati concreti.\n\nCosa ti piacerebbe sapere? 😄',
    'chatbot.placeholder': 'Chiedimi cosa ha realizzato Youngjoo Roh',
    'chatbot.projectPlaceholder': 'Chiedi all\'assistente AI del progetto',
  },
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // 브라우저 언어 감지 및 localStorage에서 언어 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('language') as Language | null
      if (savedLanguage && ['en', 'ko', 'it'].includes(savedLanguage)) {
        setLanguageState(savedLanguage)
      } else {
        // 브라우저 언어 감지
        const browserLang = navigator.language || (navigator as any).userLanguage || 'en'
        if (browserLang.startsWith('ko')) {
          setLanguageState('ko')
        } else if (browserLang.startsWith('it')) {
          setLanguageState('it')
        } else {
          setLanguageState('en')
        }
      }
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
    }
  }

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
