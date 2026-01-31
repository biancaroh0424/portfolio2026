'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

/** URL ?lang=ko|en|it 가 있으면 언어를 동기화 (챗봇/링크로 언어 지정 이동 시) */
export default function UrlLangSync() {
  const searchParams = useSearchParams()
  const { setLanguage } = useLanguage()

  useEffect(() => {
    const lang = searchParams.get('lang')
    if (lang === 'en' || lang === 'ko' || lang === 'it') {
      setLanguage(lang)
    }
  }, [searchParams, setLanguage])

  return null
}
