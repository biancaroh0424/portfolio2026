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
    if (!MIXPANEL_TOKEN) return
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      record_sessions_percent: 100,
      persistence: 'localStorage',
      debug: process.env.NODE_ENV === 'development',
    })
    // init 직후 track이 빠지지 않도록 짧게 지연 후 전송
    const t = setTimeout(() => {
      mixpanel.track('App Loaded', { source: 'portfolio' })
      if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
        console.log('[Mixpanel] init + App Loaded sent. Check Network tab for api-js.mixpanel.com.')
      }
    }, 200)
    const asciiT = setTimeout(() => {
      if (!(window as unknown as Record<string, boolean>)[ASCII_LOGGED_KEY] && typeof console !== 'undefined' && console.log) {
        (window as unknown as Record<string, boolean>)[ASCII_LOGGED_KEY] = true
        console.log('%c' + ASCII_ART, 'font-family: monospace; font-size: 10px; line-height: 1.2; color: #888;')
      }
    }, 300)
    return () => { clearTimeout(t); clearTimeout(asciiT) }
  }, [])

  return null
}
