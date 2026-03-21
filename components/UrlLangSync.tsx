'use client'

import { useLayoutEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

/** URL ?lang=ko|en|it 가 있으면 언어를 동기화 (챗봇/링크로 언어 지정 이동 시) */
export default function UrlLangSync() {
  const searchParams = useSearchParams()
  const { setLanguage } = useLanguage()

  useLayoutEffect(() => {
    const lang = searchParams.get('lang')
    if (lang === 'ko') {
      setLanguage('ko')
      return
    }
    // 현 시점에서는 EN/IT UI를 비활성화(영어 브라우저에서도 한국어로 강제)하므로
    // URL의 ?lang=en|it 가 있어도 UI 언어는 유지(한국어)합니다.
    if (lang === 'en' || lang === 'it') {
      setLanguage('ko')
    }
  }, [searchParams, setLanguage])

  return null
}
