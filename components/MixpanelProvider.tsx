'use client'

import { useEffect } from 'react'
import mixpanel from 'mixpanel-browser'

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

export default function MixpanelProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      record_sessions_percent: 100,
    })
    // Easter egg: ASCII art in console (Terrace style YJ Roh)
    if (typeof console !== 'undefined' && console.log) {
      console.log('%c' + ASCII_ART, 'font-family: monospace; font-size: 10px; line-height: 1.2; color: #888;')
    }
  }, [])

  return null
}
