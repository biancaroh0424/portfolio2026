'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useChatBot } from '@/contexts/ChatBotContext'
import { useLanguage } from '@/contexts/LanguageContext'


export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleChatBot, openChatBot, isOpen, width } = useChatBot()
  const { t } = useLanguage()
  const isMainPage = pathname === '/' || pathname === '/home'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isResumeDropdownOpen, setIsResumeDropdownOpen] = useState(false)
  const [resumeFiles, setResumeFiles] = useState<{ en?: string; ko?: string; it?: string }>({})
  const resumeDropdownRef = useRef<HTMLDivElement>(null)
  // Hydration 에러 방지: 초기값은 항상 false로 설정
  const [isMobile, setIsMobile] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // 모바일: ~879px까지, 데스크톱: 880px부터
  useEffect(() => {
    setIsMounted(true)
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 880)
    }
    
    // 초기 체크
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // width가 유효한 숫자인지 확인
  const validWidth = typeof width === 'number' && !isNaN(width) && width > 0 ? width : 320

  const navLinkClass = (href: string) =>
    `text-button rounded-[24px] px-4 py-3 transition-colors ${
      pathname === href ? 'text-white' : 'text-white/70 hover:text-white'
    }`

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false)
  }

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false)
    router.push(href)
  }

  // Resume 파일 로드
  useEffect(() => {
    const loadResumeFiles = async () => {
      try {
        const response = await fetch('/api/admin/resume')
        if (response.ok) {
          const data = await response.json()
          setResumeFiles({
            en: data.en || '',
            ko: data.ko || '',
            it: data.it || ''
          })
        }
      } catch (error) {
        console.error('Error loading resume files:', error)
      }
    }
    loadResumeFiles()
  }, [])

  // 외부 클릭 시 Resume 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resumeDropdownRef.current && !resumeDropdownRef.current.contains(event.target as Node)) {
        setIsResumeDropdownOpen(false)
      }
    }

    if (isResumeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isResumeDropdownOpen])

  const handleResumeDownload = (language: 'en' | 'ko' | 'it', url: string) => {
    if (url) {
      const link = document.createElement('a')
      link.href = url
      link.download = `resume-${language}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setIsResumeDropdownOpen(false)
      setIsMobileMenuOpen(false)
    }
  }

  return (
    <nav 
      className="fixed top-0 left-0 bg-transparent transition-all duration-10 ease-out" 
      style={{ 
        background: 'var(--nav-backgroundFill, rgba(18, 19, 19, 0.20))',
        position: 'fixed',
        right: isOpen && !isMainPage ? `${validWidth}px` : '0',
        width: isOpen && !isMainPage ? `calc(100% - ${validWidth}px)` : '100%',
        zIndex: 2000
      }}
    >
      {/* Progressive blur overlay - 상단 blur(20px)에서 하단 blur(0px)로 그라데이션 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none',
          zIndex: -1
        }}
      />
      <div 
        className="mx-auto flex w-full items-center justify-between p-3 transition-all duration-10 ease-out"
        style={{
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Left side: Hamburger (mobile) + Logo */}
        <div className="flex items-center" style={{ gap: '8px' }}>
          {/* Mobile Hamburger Menu Button - 모바일에서만 표시 */}
          {isMounted && isMobile && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex items-center justify-center text-white"
              style={{ 
                height: '40px', 
                width: '40px', 
                padding: '10px' 
              }}
              aria-label={isMobileMenuOpen ? "Close menu" : "Toggle menu"}
            >
              <div className="relative w-[20px] h-[20px]">
                <img 
                  alt="Close" 
                  className={`absolute inset-0 h-[20px] w-[20px] transition-all duration-300 ${
                    isMobileMenuOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
                  }`}
                  src="/icon/general/close.svg"
                />
                <img 
                  alt="Menu" 
                  className={`absolute inset-0 h-[20px] w-[20px] transition-all duration-300 ${
                    isMobileMenuOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'
                  }`}
                  src="/icon/menu/lines.svg"
                />
              </div>
            </button>
          )}
          
          <Link href="/home" className={isMounted && isMobile ? "h-[16px] w-[100px]" : "h-[18px] w-[120px]"} style={{ display: 'block' }}>
            <img alt="Youngjoo Roh logo" className="h-full w-full" src="/icon/logo.svg" />
          </Link>
        </div>

        {/* Desktop: Navigation Links + Action Buttons */}
        {isMounted && !isMobile && (
        <div className="flex items-center" style={{ gap: '40px' }}>
          <div className="flex items-center gap-4">
            <Link href="/portfolio" className={navLinkClass('/portfolio') + ' uppercase'}>
              {t('nav.project')}
            </Link>
            {/* Resume Dropdown */}
            <div ref={resumeDropdownRef} className="relative">
              <button
                onClick={() => setIsResumeDropdownOpen(!isResumeDropdownOpen)}
                className={`text-button rounded-[24px] px-4 py-3 transition-colors uppercase flex items-center ${
                  pathname === '/resume' || isResumeDropdownOpen ? 'text-white' : 'text-white/70 hover:text-white'
                }`}
                style={{ gap: '16px' }}
                aria-label="Resume"
                aria-expanded={isResumeDropdownOpen}
              >
                <span>{t('nav.resume')}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 16 16" 
                  fill="none"
                  className={`transition-transform duration-300 ${isResumeDropdownOpen ? 'rotate-180' : 'rotate-0'}`}
                >
                  <path d="M15 4.5L8 11.5L1 4.5" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {isResumeDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 bg-[var(--greyscale-900)] border rounded-2xl border-white/10 shadow-lg overflow-hidden p-2 min-w-[160px]" style={{ zIndex: 3000 }}>
                  {resumeFiles.en && (
                    <button
                      onClick={() => handleResumeDownload('en', resumeFiles.en!)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/70 hover:text-white transition-colors hover:bg-white/10 rounded-[8px]"
                      style={{ fontFamily: 'galmuri, monospace' }}
                    >
                      <span>English</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {resumeFiles.ko && (
                    <button
                      onClick={() => handleResumeDownload('ko', resumeFiles.ko!)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/70 hover:text-white transition-colors hover:bg-white/10 rounded-[8px]"
                      style={{ fontFamily: 'galmuri, monospace' }}
                    >
                      <span>한국어</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {resumeFiles.it && (
                    <button
                      onClick={() => handleResumeDownload('it', resumeFiles.it!)}
                      className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/70 hover:text-white transition-colors hover:bg-white/10 rounded-[8px]"
                      style={{ fontFamily: 'galmuri, monospace' }}
                    >
                      <span>Italiano</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {!resumeFiles.en && !resumeFiles.ko && !resumeFiles.it && (
                    <div className="px-3 py-2 text-[13px] text-gray-400 text-center">
                      No resume available
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-start gap-4">
            <button
              onClick={() => {
                // 포트폴리오 관련 페이지(리스트 또는 상세)에서는 현재 페이지 유지
                if (pathname === '/portfolio' || pathname?.startsWith('/portfolio/')) {
                  toggleChatBot()
                } else {
                  // 다른 페이지에서는 portfolio 리스트로 이동
                  router.push('/portfolio')
                  setTimeout(() => {
                    openChatBot()
                  }, 100)
                }
              }}
              className="uppercase flex items-center gap-2 rounded-[24px] border border-none bg-white/5 text-[13px] text-white transition-colors hover:bg-white/10"
              aria-label="AI Assistant"
              style={{ 
                padding: '12px',
              }}
            >
              <img alt="" className="h-[20px] w-[20px]" src="/icon/general/spark.svg" />
            </button>
            <a
              href="mailto:biancaroh0424@gmail.com"
              className="uppercase flex items-center gap-2 rounded-[24px] bg-[#FF6B35] px-4 py-3 text-[13px] text-white transition-colors hover:bg-[#FF7A4A] font-['GalmuriMono9']"
              aria-label="Contact"
              style={{ 
                padding: '12px 12px 12px 10px',
              }}
            >
              <img alt="" className="h-[16px] w-[16px]" src="/icon/general/mail.svg" />
              {t('nav.contact')}
            </a>
          </div>
        </div>
        )}

        {/* Mobile: AI Assistant + Contact buttons (always visible) */}
        {isMounted && isMobile && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // 포트폴리오 관련 페이지(리스트 또는 상세)에서는 현재 페이지 유지
              if (pathname === '/portfolio' || pathname?.startsWith('/portfolio/')) {
                toggleChatBot()
              } else {
                // 다른 페이지에서는 portfolio 리스트로 이동
                router.push('/portfolio')
                setTimeout(() => {
                  openChatBot()
                }, 100)
              }
            }}
            className="uppercase flex items-center gap-2 rounded-[24px] border border-none bg-white/5 text-[11px] text-white transition-colors hover:bg-white/10"
            aria-label="AI Assistant"
            style={{ 
              padding: '8px',
            }}
          >
            <img alt="" className="h-[18px] w-[18px]" src="/icon/general/spark.svg" />
          </button>
          <a
            href="mailto:biancaroh0424@gmail.com"
            className="uppercase flex items-center gap-2 rounded-[24px] bg-[#FF6B35] text-[11px] text-white transition-colors hover:bg-[#FF7A4A]"
            aria-label="Contact"
            style={{ 
              padding: '10px 12px 10px 10px',
              fontFamily: 'galmuri, monospace'
            }}
          >
            <img alt="" className="h-[14px] w-[14px]" src="/icon/general/mail.svg" />
            <span style={{ fontFamily: 'galmuri, monospace' }}>{t('nav.contact')}</span>
          </a>
        </div>
        )}
      </div>

      {/* Mobile Menu Panel — 100vh, nav 높이만큼 padding-top */}
      {isMounted && isMobile && isMobileMenuOpen && (
        <div
          className="fixed left-0 w-full bg-[var(--greyscale-800)] z-[2001] transition-all duration-300 ease-out"
          style={{
            top: 0,
            height: '100vh',
            paddingTop: '64px',
            boxSizing: 'border-box'
          }}
        >
          <div className="flex flex-col h-full">
            <div className="flex flex-col flex-1 gap-4 overflow-y-auto"
            style={{ 
              padding: '0 16px 80px'
            }}>
              <button
                onClick={() => handleNavClick('/portfolio')}
                className={`group flex items-center justify-between transition-all duration-300 hover:bg-white/5 uppercase ${
                  pathname === '/portfolio' ? 'text-white' : 'text-white/70 hover:text-white'
                }`}
                style={{ 
                  paddingTop: '16px', 
                  paddingBottom: '16px', 
                  paddingLeft: '0', 
                  paddingRight: '0',
                  fontFamily: 'GalmuriMono9',
                  fontSize: '32px',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  lineHeight: 'normal',
                  backgroundColor: 'transparent',
                  borderBottom: '1px solid var(--GreyScale-600, #303333)'
                }}
              >
                <span>{t('nav.project')}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <path d="M1.5 12H22.5M22.5 12L12 1.5M22.5 12L12 22.5" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {/* Resume Dropdown (Mobile) - 항상 펼쳐져 있음 */}
              <div className="relative" ref={resumeDropdownRef}>
                <button
                  className={`flex items-center justify-between w-full transition-all duration-300 uppercase ${
                    pathname === '/resume' ? 'text-white' : 'text-white/70'
                  }`}
                  style={{ 
                    paddingTop: '16px', 
                    paddingBottom: '16px', 
                    paddingLeft: '0', 
                    paddingRight: '0',
                    fontFamily: 'GalmuriMono9',
                    fontSize: '32px',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: 'normal',
                    backgroundColor: 'transparent',
                    cursor: 'default',
                    borderBottom: '1px solid var(--GreyScale-600, #303333)'
                  }}
                >
                  <span>{t('nav.resume')}</span>
                </button>
                {/* 모바일 메뉴에서는 항상 표시 */}
                <div className="mt-2" style={{ zIndex: 3000, position: 'relative' }}>
                  {resumeFiles.en && (
                    <button
                      onClick={() => handleResumeDownload('en', resumeFiles.en!)}
                      className="w-full flex items-center justify-between text-white/70 hover:text-white transition-colors duration-300"
                      style={{ 
                        padding: '16px 0 16px 24px',
                        alignSelf: 'stretch',
                        borderBottom: '1px solid var(--GreyScale-600, #303333)',
                        fontFamily: 'GalmuriMono9',
                        fontSize: '20px',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: 'normal'
                      }}
                    >
                      <span>English</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {resumeFiles.ko && (
                    <button
                      onClick={() => handleResumeDownload('ko', resumeFiles.ko!)}
                      className="w-full flex items-center justify-between text-white/70 hover:text-white transition-colors duration-300"
                      style={{ 
                        padding: '16px 0 16px 24px',
                        alignSelf: 'stretch',
                        borderBottom: '1px solid var(--GreyScale-600, #303333)',
                        fontFamily: 'GalmuriMono9',
                        fontSize: '20px',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: 'normal'
                      }}
                    >
                      <span>한국어</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {resumeFiles.it && (
                    <button
                      onClick={() => handleResumeDownload('it', resumeFiles.it!)}
                      className="w-full flex items-center justify-between text-white/70 hover:text-white transition-colors duration-300"
                      style={{ 
                        padding: '16px 0 16px 24px',
                        alignSelf: 'stretch',
                        borderBottom: '1px solid var(--GreyScale-600, #303333)',
                        fontFamily: 'GalmuriMono9',
                        fontSize: '20px',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: 'normal'
                      }}
                    >
                      <span>Italiano</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 14.3333V5M12 14.3333L8.11111 10.4444M12 14.3333L15.8889 10.4444M19 14.3333V17.4444C19 17.857 18.8361 18.2527 18.5444 18.5444C18.2527 18.8361 17.857 19 17.4444 19H6.55556C6.143 19 5.74733 18.8361 5.45561 18.5444C5.16389 18.2527 5 17.857 5 17.4444V14.3333" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  {!resumeFiles.en && !resumeFiles.ko && !resumeFiles.it && (
                    <div className="px-3 py-2 text-[13px] text-gray-400 text-center">
                      No resume available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

