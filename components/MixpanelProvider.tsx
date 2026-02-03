'use client'

import { useEffect } from 'react'
import mixpanel from 'mixpanel-browser'

// Mixpanel 프로젝트 토큰 (스니펫과 동일, .env.local의 NEXT_PUBLIC_MIXPANEL_TOKEN으로 덮어쓰기 가능)
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? '2a1f9cb51e79b316140268a4579fa52a'

const ASCII_ART = `
░██     ░██     ░█████    ░█████████             ░██        
 ░██   ░██        ░██     ░██     ░██            ░██        
  ░██ ░██         ░██     ░██     ░██  ░███████  ░████████  
   ░████          ░██     ░█████████  ░██    ░██ ░██    ░██ 
    ░██     ░██   ░██     ░██   ░██   ░██    ░██ ░██    ░██ 
    ░██     ░██   ░██     ░██    ░██  ░██    ░██ ░██    ░██ 
    ░██      ░██████      ░██     ░██  ░███████  ░██    ░██ 

Designed & Developed by Youngjoo Roh
Email: biancaroh0424@gmail.com
`

const ASCII_LOGGED_KEY = '__yj_ascii_art_logged'
export default function MixpanelProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 스니펫과 동일 옵션 (https://developer.mixpanel.com/docs/javascript)
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      record_sessions_percent: 100,
      persistence: 'localStorage',
      debug: process.env.NODE_ENV === 'development', // 개발 시 콘솔에 전송 로그 출력
    })
    mixpanel.track('App Loaded', { source: 'portfolio' })
    // Easter egg: ASCII art 한 번만 (Strict Mode 이중 마운트 방지)
    if (!(window as unknown as Record<string, boolean>)[ASCII_LOGGED_KEY] && typeof console !== 'undefined' && console.log) {
      (window as unknown as Record<string, boolean>)[ASCII_LOGGED_KEY] = true
      console.log('%c' + ASCII_ART, 'font-family: monospace; font-size: 10px; line-height: 1.2; color: #888;')
    }
  }, [])

  return null
}
