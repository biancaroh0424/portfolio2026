'use client'

import { useState, useEffect, useRef } from 'react'
import { useChatBot } from '@/contexts/ChatBotContext'
import { useLanguage } from '@/contexts/LanguageContext'

const isDev = process.env.NODE_ENV === 'development'

export default function TextSelectionButton() {
  const [selectedText, setSelectedText] = useState('')
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { setSelectedTextChip, isOpen, openChatBot } = useChatBot()
  const { t } = useLanguage()

  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection()
      
      if (!selection || selection.rangeCount === 0) {
        setSelectedText('')
        setButtonPosition(null)
        return
      }

      // 모바일에서 빈 Range 체크 추가
      try {
        const range = selection.getRangeAt(0)
        if (!range || range.collapsed) {
          setSelectedText('')
          setButtonPosition(null)
          return
        }
      } catch (error) {
        // 모바일에서 Range 접근 실패 시 무시
        if (isDev) console.log('Range access error (mobile):', error)
        setSelectedText('')
        setButtonPosition(null)
        return
      }

      const text = selection.toString().trim()
      
      if (!text) {
        setSelectedText('')
        setButtonPosition(null)
        return
      }

      // 선택된 텍스트가 ChapterStatus나 ChatBot 내부에 있는지 확인
      let range: Range
      try {
        range = selection.getRangeAt(0)
        if (!range || range.collapsed) {
          setSelectedText('')
          setButtonPosition(null)
          return
        }
      } catch (error) {
        if (isDev) console.log('Range getRangeAt error:', error)
        setSelectedText('')
        setButtonPosition(null)
        return
      }
      
      const startNode = range.startContainer
      
      // 선택된 노드의 부모 요소들을 확인하여 data-no-text-selection 속성이 있는지 체크
      let currentNode: Node | null = startNode.nodeType === Node.TEXT_NODE 
        ? startNode.parentElement 
        : startNode as Element
      
      let isInProjectContent = false
      let isInProjectList = false
      
      while (currentNode) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          const element = currentNode as Element
          
          // data-no-text-selection 속성이 있으면 버튼 표시 안 함
          if (element.hasAttribute('data-no-text-selection')) {
            setSelectedText('')
            setButtonPosition(null)
            return
          }
          
          // Footer 영역 확인 (footer 태그)
          if (element.tagName?.toLowerCase() === 'footer') {
            setSelectedText('')
            setButtonPosition(null)
            return
          }
          
          // 프로젝트 내용 영역 확인 (max-w-[980px] 또는 max-width: 980px)
          const hasProjectContentClass = element.classList?.contains('max-w-[980px]') || 
                                         element.getAttribute('style')?.includes('max-width: 980px') ||
                                         element.getAttribute('style')?.includes('maxWidth: 980px')
          if (hasProjectContentClass) {
            isInProjectContent = true
          }
          
          // 프로젝트 리스트 영역 확인 (max-w-7xl 또는 프로젝트 카드가 있는 영역)
          const hasProjectListClass = element.classList?.contains('max-w-7xl') ||
                                       element.querySelector('.space-y-8') !== null ||
                                       element.closest('.space-y-8') !== null
          if (hasProjectListClass) {
            isInProjectList = true
          }
        }
        currentNode = currentNode.parentNode
      }
      
      // 프로젝트 내용이나 프로젝트 리스트 영역이 아니면 버튼 표시 안 함
      if (!isInProjectContent && !isInProjectList) {
        setSelectedText('')
        setButtonPosition(null)
        return
      }

      if (isDev) console.log('Text selected:', text)
      setSelectedText(text)

      // 모바일에서 getBoundingClientRect 안전하게 호출
      let rect: DOMRect
      try {
        rect = range.getBoundingClientRect()
        // 빈 rect 체크
        if (!rect || rect.width === 0 && rect.height === 0) {
          setSelectedText('')
          setButtonPosition(null)
          return
        }
      } catch (error) {
        if (isDev) console.log('getBoundingClientRect error:', error)
        setSelectedText('')
        setButtonPosition(null)
        return
      }

      // 선택 영역 위 8px에 버튼 배치
      // getBoundingClientRect는 뷰포트 기준이므로, position: fixed는 뷰포트 기준으로 계산
      // translateY(-100%)를 사용하므로, top을 선택 영역 위 8px로 설정하면 버튼 하단이 8px 위에 위치
      const top = rect.top - 8 // 선택 영역 위 8px (뷰포트 기준)
      const left = rect.left + rect.width / 2 // 선택 영역 중앙 (뷰포트 기준)
      
      // 화면 경계 체크
      const viewportWidth = window.innerWidth
      const adjustedLeft = Math.max(100, Math.min(left, viewportWidth - 100)) // 좌우 여백 100px
      const adjustedTop = Math.max(80, top) // 상단 네비게이션 고려 (최소 80px)

      if (isDev) {
        console.log('Button position (viewport):', { top: adjustedTop, left: adjustedLeft })
        console.log('Selection rect:', rect)
        console.log('Window scroll:', { scrollY: window.scrollY, scrollX: window.scrollX })
      }
      setButtonPosition({ top: adjustedTop, left: adjustedLeft })
    }

    const handleMouseUp = () => {
      // 약간의 지연을 두어 selection이 완료되도록 함
      setTimeout(handleSelection, 10)
    }

    const handleClick = (e: MouseEvent) => {
      // 버튼 클릭은 무시
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
        return
      }
      
      // 다른 곳 클릭 시 선택 해제
      const selection = window.getSelection()
      if (selection && selection.toString().trim() === '') {
        setSelectedText('')
        setButtonPosition(null)
      }
    }

    // 스크롤 시 버튼 숨기기
    const handleScroll = () => {
      if (selectedText) {
        setSelectedText('')
        setButtonPosition(null)
        // 선택도 해제
        window.getSelection()?.removeAllRanges()
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('click', handleClick)
    document.addEventListener('selectionchange', handleSelection)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('click', handleClick)
      document.removeEventListener('selectionchange', handleSelection)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [selectedText])

  const handleButtonClick = () => {
    // selectedText를 로컬 변수에 저장 (비워지기 전에)
    const textToSend = selectedText
    
    if (textToSend && textToSend.trim()) {
      if (isDev) {
        console.log('Button clicked, selected text:', textToSend)
        console.log('setSelectedTextChip available:', !!setSelectedTextChip)
      }
      // 선택 해제 (먼저 해제)
      window.getSelection()?.removeAllRanges()
      setSelectedText('')
      setButtonPosition(null)
      
      // 챗봇이 닫혀있으면 먼저 열기
      if (!isOpen) {
        openChatBot()
        // 챗봇이 열릴 때까지 약간의 지연 후 chip 추가
        setTimeout(() => {
          if (setSelectedTextChip) {
            setSelectedTextChip(textToSend)
            if (isDev) console.log('setSelectedTextChip called with (after open):', textToSend)
          }
        }, 300)
      } else {
        if (setSelectedTextChip) {
          setSelectedTextChip(textToSend)
          if (isDev) console.log('setSelectedTextChip called with:', textToSend)
        } else {
          if (isDev) console.warn('setSelectedTextChip is not available')
        }
      }
    }
  }

  if (!buttonPosition || !selectedText) {
    return null
  }

  if (isDev) {
    console.log('Rendering button at position:', buttonPosition, 'with text:', selectedText)
    console.log('About to render button:', {
      position: buttonPosition,
      text: selectedText,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: `${buttonPosition.top}px`,
        left: `${buttonPosition.left}px`,
        transform: 'translateX(-50%) translateY(-100%)',
        zIndex: 99999,
        pointerEvents: 'auto',
        isolation: 'isolate', // 새로운 stacking context 생성
        willChange: 'transform', // 성능 최적화
      }}
    >
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 12px 12px 10px',
          backgroundColor: 'var(--greyscale-700)',
          border: '1px solid var(--fill-white-4)',
          borderRadius: '9999px', // pill shape
          cursor: 'pointer',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          visibility: 'visible',
          opacity: 1,
          fontFamily: 'galmuri, monospace',
          fontSize: '13px',
          fontStyle: 'normal',
          fontWeight: 400,
          lineHeight: 'normal',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<path d="M15 3.90909V5.18182H13.7273V5.81818H13.0909V7.09091H11.8182V5.81818H11.1818V5.18182H9.90909V3.90909H11.1818V3.27273H11.8182V2H13.0909V3.27273H13.7273V3.90909H15ZM11.1818 8.36364V9.63636H9.90909V10.2727H8.63636V10.9091H8V11.5455H7.36364V12.8182H6.72727V14.0909H5.45455V12.8182H4.81818V11.5455H4.18182V10.9091H3.54545V10.2727H2.27273V9.63636H1V8.36364H2.27273V7.72727H3.54545V7.09091H4.18182V6.45455H4.81818V5.18182H5.45455V3.90909H6.72727V5.18182H7.36364V6.45455H8V7.09091H8.63636V7.72727H9.90909V8.36364H11.1818Z" fill="#DB6930"/>
</svg>
        <span>{t('nav.aiAssistant')}</span>
      </button>
    </div>
  )
}
