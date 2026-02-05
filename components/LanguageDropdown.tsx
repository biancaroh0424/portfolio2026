'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

type LanguageOption = {
  code: 'en' | 'ko' | 'it'
  label: string
  displayName: string
  disabled?: boolean
}

const languages: LanguageOption[] = [
  { code: 'en', label: 'ENGLISH', displayName: 'ENGLISH' },
  { code: 'ko', label: '한국어', displayName: '한국어' },
  { code: 'it', label: 'ITALIANO', displayName: 'ITALIANO', disabled: true },
]

export default function LanguageDropdown() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0]

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLanguageSelect = (langCode: 'en' | 'ko' | 'it') => {
    setLanguage(langCode)
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center justify-between gap-4 p-0 text-[13px] transition-colors w-full"
        aria-label="Change language"
        aria-expanded={isOpen}
        style={{
          color: isHovered ? 'var(--text-primary, #FFF)' : 'var(--text-tertiary, #E6E6E6)',
        }}
      >
        <span className="flex items-center gap-2">
          <img alt="" className={`h-[16px]`} src="/icon/general/earth.svg" />
          <span className="font-['GalmuriMono9']" style={{ fontFamily: "'GalmuriMono9', 'galmuri', monospace" }}>
            {currentLanguage.displayName}
          </span>
        </span>
        <span className="flex h-4 w-4 items-center justify-center">
          <img 
            alt="" 
            className={`h-[16px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            src="/icon/arrowNoTail/top.svg"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </span>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-[var(--greyscale-900)] border rounded-2xl border-white/10 shadow-lg overflow-hidden p-2" style={{ zIndex: 3000 }}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              disabled={lang.disabled}
              onClick={() => !lang.disabled && handleLanguageSelect(lang.code)}
              className={`border border-transparent rounded-[8px] w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors ${
                lang.disabled ? 'text-white/40 cursor-not-allowed' : 'text-white hover:bg-white/10'
              } ${lang.code === language ? 'bg-white/5' : ''}`}
            >
              {lang.code === language && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[16px]" style={{ color: 'var(--lightblue-500)' }}>
                  <path d="M15 3L5.375 13L1 8.45455" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span className="font-['GalmuriMono9']" style={{ fontFamily: "'GalmuriMono9', 'galmuri', monospace" }}>
                {lang.displayName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
