'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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

  // 위치 계산 함수
  const calculatePosition = useCallback(() => {
    if (!isVisible || !containerRef.current || !tooltipRef.current) return
    
    // requestAnimationFrame을 사용하여 DOM이 완전히 렌더링된 후 위치 계산
    requestAnimationFrame(() => {
      if (!containerRef.current || !tooltipRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // right position인 경우 오른쪽 정렬
      if (position === 'right') {
        const left = rect.right + 8
        const top = rect.top + rect.height / 2
        
        // 화면 경계 체크
        let adjustedTop = top
        if (top - tooltipRect.height / 2 < 8) {
          adjustedTop = tooltipRect.height / 2 + 8
        }
        if (top + tooltipRect.height / 2 > viewportHeight - 8) {
          adjustedTop = viewportHeight - tooltipRect.height / 2 - 8
        }
        
        setTooltipStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${adjustedTop}px`,
          transform: 'translateY(-50%)',
          zIndex: 9999,
        })
        return
      }
      
      // bottom-right position인 경우 하단 오른쪽 정렬
      if (position === 'bottom-right') {
        let left = rect.right
        let top = rect.bottom + 8
        
        // 화면 경계 체크
        if (left + tooltipRect.width > viewportWidth - 8) {
          left = viewportWidth - tooltipRect.width - 8
        }
        if (top + tooltipRect.height > viewportHeight - 8) {
          top = rect.top - tooltipRect.height - 8
        }
        
        setTooltipStyle({
          position: 'fixed',
          left: `${left}px`,
          top: `${top}px`,
          transform: 'translateX(-100%)',
          zIndex: 9999,
        })
        return
      }
      
      // position이 명시적으로 'top'이 아니면 항상 하단에 표시
      const finalPosition = position === 'top' ? 'top' : 'bottom'
      setTooltipPosition(finalPosition)
      
      // fixed position으로 viewport 기준 위치 계산
      let left = rect.left + rect.width / 2
      
      // 하단 8px 간격으로 표시
      let top = finalPosition === 'top' 
        ? rect.top - tooltipRect.height - 8
        : rect.bottom + 8
      
      // 화면 경계 체크 및 조정
      const tooltipWidth = tooltipRect.width || 200
      const halfTooltipWidth = tooltipWidth / 2
      
      // 왼쪽 경계 체크
      if (left - halfTooltipWidth < 8) {
        left = halfTooltipWidth + 8
      }
      // 오른쪽 경계 체크
      if (left + halfTooltipWidth > viewportWidth - 8) {
        left = viewportWidth - halfTooltipWidth - 8
      }
      
      // 상하 경계 체크
      if (finalPosition === 'top' && top < 8) {
        top = rect.bottom + 8
        setTooltipPosition('bottom')
      } else if (finalPosition === 'bottom' && top + tooltipRect.height > viewportHeight - 8) {
        top = rect.top - tooltipRect.height - 8
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

  useEffect(() => {
    if (isVisible) {
      // 초기 위치 계산
      calculatePosition()
      
      // 스크롤 및 리사이즈 이벤트 리스너 추가
      const handleUpdate = () => {
        calculatePosition()
      }
      
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
        className="relative"
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
