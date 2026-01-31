'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: React.ReactNode
  text: string
  position?: 'top' | 'bottom' | 'right' | 'bottom-right' | 'auto'
}

export default function Tooltip({ children, text, position = 'auto' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom')
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // 트리거(버튼) 기준 초기 위치 — 툴팁이 main 중간에 튀어보이는 것 방지
  const setInitialPosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (position === 'right') {
      setTooltipStyle({
        position: 'fixed',
        left: `${rect.right + 8}px`,
        top: `${rect.top + rect.height / 2}px`,
        transform: 'translateY(-50%)',
        zIndex: 9999,
      })
      return
    }
    if (position === 'bottom-right') {
      setTooltipStyle({
        position: 'fixed',
        left: `${rect.right}px`,
        top: `${rect.bottom + 8}px`,
        transform: 'translateX(-100%)',
        zIndex: 9999,
      })
      return
    }
    const left = rect.left + rect.width / 2
    const top = position === 'top' ? rect.top - 40 - 8 : rect.bottom + 8
    setTooltipStyle({
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      transform: 'translateX(-50%)',
      zIndex: 9999,
    })
  }, [position])

  // 위치 계산 함수 (경계 보정)
  const calculatePosition = useCallback(() => {
    if (!isVisible || !containerRef.current || !tooltipRef.current) return
    
    requestAnimationFrame(() => {
      if (!containerRef.current || !tooltipRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      if (position === 'right') {
        const left = rect.right + 8
        const top = rect.top + rect.height / 2
        let adjustedTop = top
        if (top - tooltipRect.height / 2 < 8) adjustedTop = tooltipRect.height / 2 + 8
        if (top + tooltipRect.height / 2 > viewportHeight - 8) adjustedTop = viewportHeight - tooltipRect.height / 2 - 8
        setTooltipStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${adjustedTop}px`,
          transform: 'translateY(-50%)',
          zIndex: 9999,
        })
        return
      }
      
      if (position === 'bottom-right') {
        let left = rect.right
        let top = rect.bottom + 8
        if (left + tooltipRect.width > viewportWidth - 8) left = viewportWidth - tooltipRect.width - 8
        if (top + tooltipRect.height > viewportHeight - 8) top = rect.top - tooltipRect.height - 8
        setTooltipStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          transform: 'translateX(-100%)',
          zIndex: 9999,
        })
        return
      }
      
      const finalPosition = position === 'top' ? 'top' : 'bottom'
      setTooltipPosition(finalPosition)
      
      let left = rect.left + rect.width / 2
      let top = finalPosition === 'top' 
        ? rect.top - (tooltipRect.height || 32) - 8
        : rect.bottom + 8
      
      const tooltipWidth = tooltipRect.width || 200
      const halfTooltipWidth = tooltipWidth / 2
      if (left - halfTooltipWidth < 8) left = halfTooltipWidth + 8
      if (left + halfTooltipWidth > viewportWidth - 8) left = viewportWidth - halfTooltipWidth - 8
      
      if (finalPosition === 'top' && top < 8) {
        top = rect.bottom + 8
        setTooltipPosition('bottom')
      } else if (finalPosition === 'bottom' && top + (tooltipRect.height || 32) > viewportHeight - 8) {
        top = rect.top - (tooltipRect.height || 32) - 8
        setTooltipPosition('top')
      }
      
      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translateX(-50%)',
        zIndex: 9999,
      })
    })
  }, [isVisible, position])

  // 페인트 전에 초기 위치 설정 → 툴팁이 다른 곳에 튀어보이는 것 방지
  useLayoutEffect(() => {
    if (isVisible) {
      setInitialPosition()
    }
  }, [isVisible, position, setInitialPosition])

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
      const handleUpdate = () => calculatePosition()
      window.addEventListener('scroll', handleUpdate, true)
      window.addEventListener('resize', handleUpdate)
      return () => {
        window.removeEventListener('scroll', handleUpdate, true)
        window.removeEventListener('resize', handleUpdate)
      }
    }
  }, [isVisible, position, calculatePosition])

  return (
    <>
      <div
        ref={containerRef}
        className="relative inline-flex shrink-0"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && typeof window !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className="pointer-events-none"
          style={{
            ...tooltipStyle,
            display: 'flex',
            padding: '8px',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '8px',
            background: 'var(--tooltip-body, rgba(18, 19, 19, 0.80))',
            backdropFilter: 'blur(10px)',
            maxWidth: '90vw',
            wordBreak: 'break-word',
            whiteSpace: 'normal',
          }}
        >
          <span
            style={{
              color: 'var(--text-primary, #FFF)',
              fontFamily: '"Pretendard Variable"',
              fontSize: '14px',
              fontStyle: 'normal',
              fontWeight: 400,
              lineHeight: '160%',
              whiteSpace: 'nowrap'
            }}
          >
            {text}
          </span>
        </div>,
        document.body
      )}
    </>
  )
}
