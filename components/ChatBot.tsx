'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { marked } from 'marked'
import { useChatBot } from '@/contexts/ChatBotContext'
import { useLanguage } from '@/contexts/LanguageContext'
import ChatHistoryItem from './ChatHistoryItem'
import Tooltip from './Tooltip'

// Thinking Process 단계 인터페이스
interface ThinkingStep {
  step: number
  status: string // "완료", "진행 중", "대기 중"
  description: string
  activity?: string
  details?: string[]
}

// 드래그한 텍스트 표시 컴포넌트 (메시지 내부에 표시)
function SelectedTextChip({ selectedText }: { selectedText: string }) {
  // 고유한 clipPath ID 생성
  const clipId = `clip-${Math.random().toString(36).substring(2, 9)}`
  
  return (
    <Tooltip text={selectedText} position="top">
      <div
        style={{
          display: 'flex',
          width: '100%',
          maxWidth: '240px',
          padding: '8px',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '8px',
          border: '1px solid var(--fillWhite-10, rgba(255, 255, 255, 0.10))',
          background: 'var(--fillWhite-4, rgba(255, 255, 255, 0.04))',
          backdropFilter: 'blur(10px)',
          cursor: 'default',
        }}
      >
        {/* 아이콘 */}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <g clipPath={`url(#${clipId})`}>
            <path d="M8.09375 0.875002H3.71875C3.42867 0.875002 3.15047 1.00406 2.94535 1.2338C2.74023 1.46353 2.625 1.77511 2.625 2.1V11.9C2.625 12.2249 2.74023 12.5365 2.94535 12.7662C3.15047 12.9959 3.42867 13.125 3.71875 13.125H10.2812C10.5713 13.125 10.8495 12.9959 11.0546 12.7662C11.2598 12.5365 11.375 12.2249 11.375 11.9V4.55M8.09375 0.875002C8.26686 0.874688 8.43833 0.912733 8.59826 0.986948C8.75819 1.06116 8.90343 1.17008 9.02562 1.30743L10.9878 3.50508C11.1108 3.64197 11.2083 3.8048 11.2748 3.98415C11.3412 4.1635 11.3753 4.35582 11.375 4.55M8.09375 0.875002V3.9375C8.09375 4.09995 8.15137 4.25574 8.25392 4.3706C8.35648 4.48547 8.49558 4.55 8.64062 4.55L11.375 4.55" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
          <defs>
            <clipPath id={clipId}>
              <rect width="14" height="14" fill="white"/>
            </clipPath>
          </defs>
        </svg>
        {/* 텍스트 */}
        <div
          style={{
            overflow: 'hidden',
            color: 'var(--text-tertiary, #E6E6E6)',
            textOverflow: 'ellipsis',
            fontFamily: '"Pretendard Variable", sans-serif',
            fontSize: '13px',
            fontStyle: 'normal',
            fontWeight: 400,
            lineHeight: '160%',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {selectedText}
        </div>
      </div>
    </Tooltip>
  )
}

// Chip Text Content 컴포넌트 (hover 시 x 버튼 표시)
function ChipTextContent({ selectedTextChip, onRemove }: { selectedTextChip: string; onRemove: () => void }) {
  const [isHovered, setIsHovered] = useState(false)
  
  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        gap: '8px',
        width: '100%',
        paddingTop:'8px',
        paddingBottom:'16px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ 
        flex: 1,
        fontSize: '13px',
        color: 'var(--text-primary)',
        lineHeight: '1.6',
        wordBreak: 'break-word',
        fontFamily: 'pretendard, sans-serif',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {selectedTextChip}
      </div>
      <button
        onClick={onRemove}
        style={{ 
          flexShrink: 0,
          width: '24px',
          height: '24px',
          minWidth: '24px',
          minHeight: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--button-iconOnlyHovered, rgba(255, 255, 255, 0.20))',
          border: 'none',
          borderRadius: '8px',
          cursor: isHovered ? 'pointer' : 'default',
          transition: 'opacity 0.2s',
          padding: 0,
          boxSizing: 'border-box',
          lineHeight: 0,
          opacity: isHovered ? 1 : 0,
          pointerEvents: isHovered ? 'auto' : 'none'
        }}
        aria-label="Remove chip"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 0.5L0.5 11M0.5 0.5L11 11" stroke="white" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}

// Thinking Process 표시 컴포넌트
function ThinkingAccordion({ thinking, isActive, thinkingDone, contentPending }: { thinking: string; isActive: boolean; thinkingDone: boolean; contentPending?: boolean }) {
  // 답변이 들어오기 전(thinkingDone이어도 content 빈 구간)까지 로더·step 유지 → 깜빡임 방지
  const showActiveUI = isActive || contentPending === true
  // 스텝 작성 중: thinking 텍스트가 들어오는 대로 차례대로 보이도록 (한 번에 덩어리 X)
  const [displayedLength, setDisplayedLength] = useState(0)
  const targetLengthRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    targetLengthRef.current = thinking.length
    if (thinking.length < displayedLength) {
      // 새 메시지 등 thinking 리셋 시 표시 길이도 리셋
      setDisplayedLength(thinking.length)
    }
    if (thinkingDone || !isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setDisplayedLength(thinking.length)
      return
    }
    if (thinking.length <= displayedLength) return
    const step = 2
    const ms = 28
    intervalRef.current = setInterval(() => {
      setDisplayedLength((prev) => {
        const target = targetLengthRef.current
        const next = Math.min(prev + step, target)
        if (next >= target && intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return next
      })
    }, ms)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    // displayedLength 의존 시 매 틱마다 effect 재실행되어 스트리밍 깨짐 → 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking, thinkingDone, isActive])

  const displayedThinking = thinking.slice(0, displayedLength)

  // Thinking을 단계별로 파싱 (간단한 형식)
  const parseThinking = (thinkingText: string, isComplete: boolean): ThinkingStep[] => {
    // 깨진 문자열이나 암호화된 데이터 필터링
    if (!thinkingText || thinkingText.length === 0) {
      return []
    }
    
    // 깨진 문자나 바이너리 데이터 감지
    const printableChars = thinkingText.match(/[\x20-\x7E\uAC00-\uD7A3\n\r\t]/g)?.length || 0
    const printableRatio = printableChars / thinkingText.length
    if (printableRatio < 0.5) {
      console.warn('[Thinking] Detected corrupted/binary data, skipping')
      return []
    }
    
    const steps: ThinkingStep[] = []
    const lines = thinkingText.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    let currentStep: { step: number; lines: string[]; status: ThinkingStep['status'] } | null = null

    const flushStep = () => {
      if (!currentStep) return
      const description = currentStep.lines
        .filter(line => line !== '✓' && line !== '✔' && line !== '완료' && line.trim() !== '...')
        .join(' ')
        .trim()
      if (description && description !== '...') {
        steps.push({
          step: currentStep.step,
          status: currentStep.status,
          description
        })
      }
      currentStep = null
    }

    for (const line of lines) {
      const linePrintableRatio = (line.match(/[\x20-\x7E\uAC00-\uD7A3]/g)?.length || 0) / Math.max(line.length, 1)
      if (linePrintableRatio < 0.5) {
        continue
      }

      // Step 형식: "Step 1", "단계 1", "Step 1: ...", "단계 1: ..."
      const stepOnlyMatch = line.match(/^(?:Step|단계)\s*(\d+)\s*$/i)
      const stepInlineMatch = line.match(/^(?:Step|단계)\s*(\d+)[:.]?\s*(.+)$/i)
      
      // 숫자 형식: "1. ...", "1) ...", "1 ..."
      const numberStepMatch = line.match(/^(\d+)[.)]\s*(.+)$/)

      if (stepOnlyMatch || stepInlineMatch || numberStepMatch) {
        flushStep()
        let stepNum: number
        let stepContent: string | undefined
        
        if (stepOnlyMatch || stepInlineMatch) {
          stepNum = parseInt((stepOnlyMatch || stepInlineMatch)![1], 10)
          stepContent = stepInlineMatch ? stepInlineMatch[2] : undefined
        } else {
          stepNum = parseInt(numberStepMatch![1], 10)
          stepContent = numberStepMatch![2]
        }
        
        currentStep = {
          step: stepNum,
          lines: [],
          status: '진행 중'
        }
        if (stepContent) {
          currentStep.lines.push(stepContent.trim())
        }
        continue
      }

      if (currentStep) {
        if (line === '✓' || line === '✔' || line.toLowerCase() === 'done' || line === '완료') {
          currentStep.status = '완료'
        } else {
          currentStep.lines.push(line)
        }
      }
    }

    flushStep()
    
    // Step 번호로 정렬
    steps.sort((a, b) => a.step - b.step)
    
    // 완료 시 모두 "완료", 진행 중일 때만 마지막을 "진행 중"으로 표시
    return steps.map((step, idx) => ({
      ...step,
      status: isComplete ? '완료' : idx === steps.length - 1 ? '진행 중' : '완료'
    }))
  }
  
  const steps = useMemo(() => parseThinking(thinking, !isActive), [thinking, isActive])
  const currentStep = steps[steps.length - 1]
  const completedSteps = steps.filter(s => s.status === '완료').length
  
  // thinking이 있으면 항상 표시 (steps가 없어도)
  // steps가 없고 진행 중이 아니면 표시하지 않음 -> 이 조건 제거
  // if (steps.length === 0 && !isActive) {
  //   return null
  // }

  
  return (
    <div style={{ 
      marginTop: '16px', 
      paddingTop: '16px',
      paddingBottom: '12px'
    }}>
      {/* 1) 스텝 작성되는 동안 + 답변 대기 중(contentPending): 로더 + shimmer 유지 */}
      {((showActiveUI && !thinkingDone) || contentPending) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid var(--text-tertiary, #E6E6E6)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                flexShrink: 0
              }}
            />
            <span
              className="animate-shimmer-text"
              style={{
                fontSize: '11px',
                color: 'var(--text-tertiary, #E6E6E6)',
                fontFamily: '"Pretendard Variable", sans-serif'
              }}
            >
              Thinking
            </span>
          </div>
        </div>
      )}

      {/* 2) steps 없을 때: 한 블록으로 유지 → 완료 전에 사라졌다 나타나는 현상 방지 (아이콘만 circle ↔ checkmark) */}
      {steps.length === 0 && thinking.trim().length > 0 && (
        <>
          {thinkingDone && !contentPending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', width: '100%' }}>
              <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C11.5899 1.5 14.5 4.41015 14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5Z" stroke="#72C1DB"/>
                  <path d="M11 6L6.875 10L5 8.18182" stroke="#72C1DB" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary, #E6E6E6)', fontFamily: '"Pretendard Variable", sans-serif', lineHeight: '160%' }}>
                1 step completed
              </span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              width: '100%',
              minHeight: '27px',
              padding: '0 8px 8px 8px',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              borderLeft: '0.6px solid var(--fillWhite-20, rgba(255, 255, 255, 0.20))'
            }}
          >
            <div style={{ display: 'flex', width: '16px', height: '16px', padding: '2px', justifyContent: (thinkingDone && !contentPending) ? 'space-between' : 'center', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {(thinkingDone && !contentPending) ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M11.25 2.25L4.03125 9.75L0.75 6.34091" stroke="#72C1DB" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1.25C8.62335 1.25 10.75 3.37665 10.75 6C10.75 8.62335 8.62335 10.75 6 10.75C3.37665 10.75 1.25 8.62335 1.25 6C1.25 3.37665 3.37665 1.25 6 1.25Z" stroke="#B3B3B3" />
                </svg>
              )}
            </div>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary, #E6E6E6)',
                fontFamily: '"Pretendard Variable", sans-serif',
                width: '100%',
                minWidth: 0,
                flex: 1,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.6
              }}
            >
              {(thinkingDone && !contentPending) ? thinking.trim() : displayedThinking.trim()}
            </span>
          </div>
        </>
      )}

      {/* 3) Step 작성 중/답변 대기 중: Figma — 파싱된 step이 있으면 해당 행 */}
      {((showActiveUI && !thinkingDone) || contentPending) && currentStep?.description && (
        <div
          style={{
            display: 'flex',
            width: '100%',
            minHeight: '27px',
            padding: '0 8px 8px 8px',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            borderLeft: '0.6px solid var(--fillWhite-20, rgba(255, 255, 255, 0.20))'
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '16px',
              height: '16px',
              padding: '2px',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.25C8.62335 1.25 10.75 3.37665 10.75 6C10.75 8.62335 8.62335 10.75 6 10.75C3.37665 10.75 1.25 8.62335 1.25 6C1.25 3.37665 3.37665 1.25 6 1.25Z" stroke="#B3B3B3" />
            </svg>
          </div>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary, #E6E6E6)',
              fontFamily: '"Pretendard Variable", sans-serif',
              width: '100%',
              minWidth: 0,
              flex: 1,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6
            }}
          >
            {currentStep.description}
          </span>
        </div>
      )}

      {/* Steps 표시 (일반 div, 펼침/접힘 없음) */}
      {steps.length > 0 && !contentPending && (
        <div style={{ marginTop: '0', display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingBottom: '12px',
              width: '100%'
            }}
          >
            <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5C11.5899 1.5 14.5 4.41015 14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5Z" stroke="#72C1DB"/>
                <path d="M11 6L6.875 10L5 8.18182" stroke="#72C1DB" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ 
              fontSize: '12px', 
              color: 'var(--text-tertiary, #E6E6E6)',
              fontFamily: '"Pretendard Variable", sans-serif',
              lineHeight: '160%',
              flex: 1
            }}>
              {completedSteps} steps completed
            </span>
          </div>
          {steps
            .filter(step => step.description && step.description.trim().length > 0 && step.description.trim() !== '...')
            .map((step, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  width: '100%',
                  minHeight: '27px',
                  padding: '0 8px 8px 8px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '6px',
                  borderLeft: '0.6px solid var(--fillWhite-20, rgba(255, 255, 255, 0.20))'
                }}
              >
                {step.status === '완료' && (
                  <div
                    style={{
                      display: 'flex',
                      width: '16px',
                      height: '16px',
                      padding: '2px',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M11.25 2.25L4.03125 9.75L0.75 6.34091" stroke="#72C1DB" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {step.status === '진행 중' && (
                  <div
                    style={{
                      display: 'flex',
                      width: '16px',
                      height: '16px',
                      padding: '2px',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '8px',
                      flexShrink: 0
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1.25C8.62335 1.25 10.75 3.37665 10.75 6C10.75 8.62335 8.62335 10.75 6 10.75C3.37665 10.75 1.25 8.62335 1.25 6C1.25 3.37665 3.37665 1.25 6 1.25Z" stroke="#B3B3B3" />
                    </svg>
                  </div>
                )}
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary, #E6E6E6)',
                    flex: 1,
                    minWidth: 0,
                    fontFamily: '"Pretendard Variable", sans-serif',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {step.description}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ id: string; title: string; anchor?: string; headingIndex?: number; type?: string; projectId?: string }>
  thinking?: string // Thinking process
  thinkingDone?: boolean
  selectedText?: string // 드래그한 텍스트
}

interface ProjectPreview {
  id: string
  title: string
  subtitle?: string
  thumbnail?: string
}

interface ChatBotProps {
  projectId?: string
  autoSummarize?: boolean
}

const STORAGE_KEY = 'yj-assistant-messages'
const HISTORY_STORAGE_KEY = 'yj-assistant-history'

// 히스토리 인터페이스
interface ChatHistory {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

// 쿠키 헬퍼 함수
function setCookie(name: string, value: string, days: number = 365) {
  if (typeof window === 'undefined') return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/`
}

function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null
  const nameEQ = name + '='
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
  }
  return null
}

function deleteCookie(name: string) {
  if (typeof window === 'undefined') return
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}

// 첫 번째 질문을 요약하는 함수
function summarizeFirstQuestion(firstMessage: string): string {
  if (!firstMessage || firstMessage.trim().length === 0) {
    return 'New Chat'
  }
  
  // 간단한 요약 매핑
  const summaryMap: { [key: string]: string } = {
    '안녕': '안부 인사',
    '안녕하세요': '안부 인사',
    'hello': 'Greeting',
    'hi': 'Greeting',
    'ciao': 'Saluto',
  }
  
  const lowerMessage = firstMessage.toLowerCase().trim()
  
  // 매핑된 요약이 있으면 사용
  for (const [key, value] of Object.entries(summaryMap)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value
    }
  }
  
  // 짧은 메시지(30자 이하)는 그대로 사용
  if (firstMessage.length <= 30) {
    return firstMessage
  }
  
  // 긴 메시지는 앞부분 + ...
  return firstMessage.substring(0, 30) + '...'
}

// 쿠키에서 히스토리 로드
function loadHistoryFromCookie(): ChatHistory[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = getCookie(HISTORY_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to load history from cookie:', e)
  }
  return []
}

// 쿠키에 히스토리 저장
function saveHistoryToCookie(history: ChatHistory[]) {
  if (typeof window === 'undefined') return
  try {
    const json = JSON.stringify(history)
    setCookie(HISTORY_STORAGE_KEY, json, 365) // 1년간 유지
  } catch (e) {
    console.warn('Failed to save history to cookie:', e)
  }
}

// localStorage에서 메시지 로드 (새로고침 시 진행 중이던 스트림은 완료로 간주)
function loadMessagesFromStorage(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 최소한 초기 메시지가 있는지 확인
      if (Array.isArray(parsed) && parsed.length > 0) {
        const last = parsed[parsed.length - 1]
        // 마지막이 assistant이고 thinkingDone이 false면 새로고침으로 끊긴 “진행 중” 상태 → 완료로 정규화. 로더+shimmer와 "..." 표시 둘 다 제거
        if (last?.role === 'assistant' && last.thinkingDone === false) {
          const t = typeof last.thinking === 'string' ? last.thinking.trim() : ''
          const isPlaceholder = !t || /^\.+$/.test(t) || t === '...'
          return parsed.slice(0, -1).concat({
            ...last,
            thinkingDone: true,
            ...(isPlaceholder ? { thinking: '' } : {})
          })
        }
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to load messages from storage:', e)
  }
  // 저장된 메시지가 없으면 빈 배열 반환 (기본 메시지는 컴포넌트에서 설정)
  return []
}

// localStorage에 메시지 저장
function saveMessagesToStorage(messages: Message[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (e) {
    console.warn('Failed to save messages to storage:', e)
  }
}

// 기본 초기 메시지 생성 함수 (useLanguage를 사용하도록 수정됨)
function getDefaultMessage(greetingText: string): Message[] {
  return [{
    id: '1',
    role: 'assistant',
    content: greetingText
  }]
}

export default function ChatBot({ projectId, autoSummarize = false }: ChatBotProps) {
  const { t, language } = useLanguage()
  
  // Hydration 에러 방지: 초기 state는 항상 동일하게 설정
  const [messages, setMessages] = useState<Message[]>(getDefaultMessage(t('chatbot.greeting')))
  const [isMounted, setIsMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([])
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const { setChatInputSetter, chatInput, setChatInput, selectedTextChip, setSelectedTextChip, setSendMessage, closeChatBot, isOpen } = useChatBot()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const ignoreNextInputChangeRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const historyDropdownRef = useRef<HTMLDivElement>(null)
  const isSendingRef = useRef(false) // 중복 전송 방지
  
  // 새 채팅 시작
  const handleNewChat = useCallback(() => {
    const newMessages = getDefaultMessage(t('chatbot.greeting'))
    setMessages(newMessages)
    setChatInput('')
    setIsHistoryOpen(false)
    setCurrentHistoryId(null)
    // 진행 중인 응답이 있으면 중단
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
    // 현재 메시지를 localStorage에서 제거 (새 채팅이므로)
    saveMessagesToStorage(newMessages)
  }, [setChatInput])
  
  // 히스토리 저장
  const saveCurrentChatToHistory = useCallback((messagesToSave: Message[]) => {
    // 기본 메시지(인사말)만 있으면 저장하지 않음
    const userMessages = messagesToSave.filter(msg => msg.role === 'user')
    if (userMessages.length === 0) return
    
    const firstUserMessage = userMessages[0]
    const title = summarizeFirstQuestion(firstUserMessage.content)
    const historyId = currentHistoryId || `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    
    const newHistory: ChatHistory = {
      id: historyId,
      title,
      messages: messagesToSave,
      createdAt: Date.now()
    }
    
    setChatHistory(prev => {
      // 기존 히스토리가 있으면 업데이트, 없으면 추가
      const existingIndex = prev.findIndex(h => h.id === historyId)
      let updated: ChatHistory[]
      if (existingIndex >= 0) {
        updated = [...prev]
        updated[existingIndex] = newHistory
      } else {
        updated = [newHistory, ...prev] // 최신이 앞에
      }
      // 최대 50개까지만 저장
      const limited = updated.slice(0, 50)
      saveHistoryToCookie(limited)
      return limited
    })
    
    setCurrentHistoryId(historyId)
  }, [currentHistoryId])
  
  // 히스토리 로드
  const loadHistory = useCallback((historyId: string) => {
    const history = chatHistory.find(h => h.id === historyId)
    if (history) {
      setMessages(history.messages)
      setCurrentHistoryId(historyId)
      setIsHistoryOpen(false)
      saveMessagesToStorage(history.messages)
    }
  }, [chatHistory])
  
  // 히스토리 삭제
  const deleteHistory = useCallback((historyId: string) => {
    setChatHistory(prev => {
      const updated = prev.filter(h => h.id !== historyId)
      saveHistoryToCookie(updated)
      return updated
    })
    // 현재 로드된 히스토리를 삭제한 경우 새 채팅으로
    if (currentHistoryId === historyId) {
      handleNewChat()
    }
  }, [currentHistoryId, handleNewChat])
  
  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false)
      }
    }
    
    if (isHistoryOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isHistoryOpen])
  
  // Context에 setInput 함수 등록 (하위 호환성)
  useEffect(() => {
    if (!setChatInputSetter || !isMounted) return
    
    const inputSetter = (text: string) => {
      if (text) {
        setChatInput(text)
        // input 필드에 포커스 (선택적)
        setTimeout(() => {
          inputRef.current?.focus()
        }, 100)
      }
    }
    setChatInputSetter(inputSetter)
    
    // cleanup: 컴포넌트 언마운트 시 제거
    return () => {
      if (setChatInputSetter) {
        setChatInputSetter(() => {})
      }
    }
  }, [isMounted, setChatInputSetter, setChatInput])
  
  // 챗봇이 열릴 때 인풋에 자동 포커스
  useEffect(() => {
    if (isOpen && isMounted && inputRef.current) {
      // 챗봇이 열릴 때 약간의 지연 후 포커스 (애니메이션 완료 대기)
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isMounted])

  
  
  const [projects, setProjects] = useState<ProjectPreview[]>([])
  const hasAutoSummarizedRef = useRef<Record<string, boolean>>({}) // 프로젝트별로 추적
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages) // 최신 messages 참조용
  const streamQueuesRef = useRef(
    new Map<
      string,
      {
        contentQueue: string[]
        thinkingQueue: string[]
        timer?: ReturnType<typeof setInterval>
        pendingContent: string
        answerStarted: boolean
        thinkingEnded: boolean
        thinkingDone: boolean
        done: boolean
        sources?: Message['sources']
      }
    >()
  )
  const lastThinkingFlushAtRef = useRef(0)
  const thinkingFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingThinkingRef = useRef<{ id: string; text: string; thinkingDone: boolean } | null>(null)
  /** AI가 "열어드릴까요?" 등으로 제안한 포트폴리오 링크 — 사용자가 "응" 등으로 확인 시 열기 */
  const pendingOpenRef = useRef<{ projectId: string; anchor?: string } | null>(null)
  const pathname = usePathname()

  // Placeholder 스타일 적용
  useEffect(() => {
    const styleId = 'chatbot-input-placeholder-style'
    if (document.getElementById(styleId)) return
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      #chatbot-input-container textarea::placeholder {
        color: var(--text-placeholder, #B3B3B3);
        font-family: "Pretendard Variable", sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 160%;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [])

  // 클라이언트에서만 localStorage에서 메시지 로드 및 히스토리 로드 (Hydration 완료 후)
  useEffect(() => {
    setIsMounted(true)
    
    // 히스토리 로드
    const loadedHistory = loadHistoryFromCookie()
    setChatHistory(loadedHistory)
    
    const storedMessages = loadMessagesFromStorage()
    if (storedMessages.length > 0) {
      setMessages(storedMessages)
      messagesRef.current = storedMessages
    } else {
      // 저장된 메시지가 없으면 현재 언어(브라우저 언어 반영)로 초기 메시지 설정
      const defaultMsgs = getDefaultMessage(t('chatbot.greeting'))
      setMessages(defaultMsgs)
      messagesRef.current = defaultMsgs
    }
  }, [])

  // 브라우저/선택 언어 변경 시 환영 메시지만 있을 때 해당 언어로 환영 문구 동기화
  useEffect(() => {
    if (!isMounted) return
    const current = messagesRef.current ?? messages
    const isOnlyGreeting = current.length === 1 && current[0]?.role === 'assistant'
    if (isOnlyGreeting) {
      const defaultMsgs = getDefaultMessage(t('chatbot.greeting'))
      setMessages(defaultMsgs)
      messagesRef.current = defaultMsgs
      saveMessagesToStorage(defaultMsgs)
    }
  }, [language])

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/admin/projects')
        if (!response.ok) return
        const data = await response.json()
        if (Array.isArray(data)) {
          setProjects(
            data.map((project) => {
              // 다국어 구조 지원: 현재 언어의 translation에서 제목 가져오기
              let title = ''
              if (project.translations?.[language]) {
                title = project.translations[language].title || ''
              } else if (language === 'en' && project.title) {
                // 하위 호환성: 영어일 때 기존 title 사용
                title = project.title
              } else if (project.translations?.en) {
                // 현재 언어에 없으면 영어로 fallback
                title = project.translations.en.title || ''
              }
              
              return {
                id: project.id,
                title: title,
                subtitle: project.subtitle,
                thumbnail: project.thumbnail || undefined,
              }
            })
          )
        }
      } catch (error) {
        console.warn('Failed to load projects for chat previews:', error)
      }
    }

    loadProjects()
  }, [language])

  // messages가 변경될 때마다 ref 업데이트 및 localStorage 저장, 히스토리 저장 (클라이언트에서만)
  useEffect(() => {
    if (isMounted) {
      messagesRef.current = messages
      saveMessagesToStorage(messages)
      
      // 사용자 메시지가 있고 기본 메시지가 아닌 경우 히스토리에 저장
      const userMessages = messages.filter(msg => msg.role === 'user')
      if (userMessages.length > 0) {
        // 기본 인사말이 아닌 실제 대화인 경우에만 저장
        const hasRealConversation = messages.some(msg => 
          msg.role === 'user' && 
          msg.content.trim().length > 0 &&
          !msg.content.toLowerCase().includes('hello') &&
          !msg.content.toLowerCase().includes('안녕')
        ) || messages.length > 2 // 기본 인사말 2개보다 많으면 실제 대화
        
        if (hasRealConversation) {
          saveCurrentChatToHistory(messages)
        }
      }
    }
  }, [messages, isMounted, saveCurrentChatToHistory])

  useEffect(() => {
    const queues = streamQueuesRef.current
    return () => {
      queues.forEach((queue) => {
        if (queue.timer) clearInterval(queue.timer)
      })
      queues.clear()
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // input 값이 변경될 때 높이 조절
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [chatInput])

  const handleSend = useCallback(async (message?: string, skipUserMessage: boolean = false) => {
    // AI가 응답 중이면 전송 차단
    if (isLoading || isSendingRef.current) return
    
    const userMessage = message || (chatInput || '').trim()
    if (!userMessage) return
    
    // 전송 시작 표시
    isSendingRef.current = true

    // chip이 있으면 API 전송용 메시지에 포함 (하지만 UI에는 selectedText로 저장)
    const currentSelectedTextChip = selectedTextChip
    const messageWithContext = currentSelectedTextChip 
      ? `${userMessage}\n\n[Selected Context: ${currentSelectedTextChip}]`
      : userMessage

    setChatInput('')
    setIsLoading(true)
    
    // textarea 높이 초기화
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    
    // chip 제거 (메시지 전송 후)
    if (setSelectedTextChip) {
      setSelectedTextChip(null)
    }

    // 고유한 ID 생성 (타임스탬프 + 랜덤)
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 9)

    // 편집 모드가 아닌 경우에만 새 사용자 메시지 추가
    if (!skipUserMessage) {
      const newUserMessage: Message = {
        id: `user-${timestamp}-${random}`,
        role: 'user',
        content: userMessage, // 순수한 사용자 메시지만 저장 (chip은 selectedText에 저장)
        selectedText: currentSelectedTextChip || undefined // 드래그한 텍스트 저장
      }

      setMessages(prev => [...prev, newUserMessage])
    }

    // 스트리밍 메시지 ID (고유하게 생성)
    const streamingMessageId = `assistant-${timestamp + 1}-${random}`
    const assistantMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      thinking: '' // 초기 thinking 상태 추가
    }

    setMessages(prev => [...prev, assistantMessage])

    const startStreamTimer = (id: string) => {
      const queue = streamQueuesRef.current.get(id)
      if (!queue || queue.timer) return
      queue.timer = setInterval(() => {
        const currentQueue = streamQueuesRef.current.get(id)
        if (!currentQueue) {
          if (queue.timer) clearInterval(queue.timer)
          return
        }
        const nextThinking = currentQueue.thinkingQueue.length > 0 ? currentQueue.thinkingQueue.shift() : undefined
        const nextContent = !nextThinking && currentQueue.contentQueue.length > 0 ? currentQueue.contentQueue.shift() : undefined
        if (!nextContent && !nextThinking) {
          clearInterval(currentQueue.timer)
          currentQueue.timer = undefined
          if (currentQueue.sources) {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === id
                  ? {
                      ...msg,
                      sources: currentQueue.sources,
                      thinkingDone: currentQueue.thinkingDone ?? msg.thinkingDone
                    }
                  : msg
              )
            )
          }
          streamQueuesRef.current.delete(id)
          return
        }
        setMessages(prev =>
          prev.map(msg =>
            msg.id === id
              ? {
                  ...msg,
                  content: nextContent ? `${msg.content}${nextContent}` : msg.content,
                  thinking: nextThinking
                    ? `${msg.thinking || ''}${nextThinking}`.replace(/^<+/, '').replace(/<thinking>/gi, '').replace(/<\/thinking>/gi, '')
                    : msg.thinking,
                }
              : msg
          )
        )
        streamQueuesRef.current.set(id, currentQueue)
      }, 10) // 20ms -> 10ms로 단축하여 더 빠른 응답
    }

    const enqueueStreamDelta = (id: string, deltaContent?: string, deltaThinking?: string) => {
      const queue =
        streamQueuesRef.current.get(id) ||
        {
          contentQueue: [],
          thinkingQueue: [],
          pendingContent: '',
          answerStarted: false,
          thinkingEnded: false,
          thinkingDone: false,
          done: false,
        }

      if (deltaThinking) {
        queue.thinkingQueue.push(...deltaThinking.split(''))
      }

      if (deltaContent) {
        queue.pendingContent += deltaContent

        // 불완전한 태그 시작 확인
        // "<" 뒤에 알파벳이 오는 경우만 태그로 간주 (예: "<t", "<th", "<think" 등)
        // 단순히 "<"만 있으면 일반 텍스트로 처리
        const incompleteTagMatch = queue.pendingContent.match(/<[a-z][^>]*$/i)
        if (incompleteTagMatch && !queue.pendingContent.includes('<thinking>') && !queue.pendingContent.includes('<answer>') && !queue.pendingContent.includes('</thinking>') && !queue.pendingContent.includes('</answer>')) {
          // 불완전한 태그가 있으면 대기 (예: "<t", "<th", "<think" 등)
          streamQueuesRef.current.set(id, queue)
          startStreamTimer(id)
          return
        }
        
        // "<"로 끝나지만 그 뒤에 알파벳이 없으면 일반 텍스트로 처리
        // 이 경우 대기하지 않고 바로 처리 진행
        // 단, 이미 완전한 태그가 있으면 그대로 진행

        // thinking 태그가 있는지 확인 (처음부터)
        const hasThinkingTag = queue.pendingContent.includes('<thinking>')
        const thinkingEndIndex = queue.pendingContent.indexOf('</thinking>')
        
        if (hasThinkingTag && thinkingEndIndex === -1) {
          // thinking이 아직 끝나지 않음 - 대기
          streamQueuesRef.current.set(id, queue)
          startStreamTimer(id)
          return
        }

        if (hasThinkingTag && thinkingEndIndex >= 0) {
          // thinking이 끝남
          queue.thinkingEnded = true
          queue.pendingContent = queue.pendingContent.slice(thinkingEndIndex + '</thinking>'.length)
        } else if (!hasThinkingTag && !queue.thinkingEnded) {
          // thinking 태그가 없으면 바로 처리
          queue.thinkingEnded = true
          queue.thinkingDone = true // thinking이 없으면 바로 done
          setMessages(prev =>
            prev.map(msg =>
              msg.id === id
                ? { ...msg, thinkingDone: true }
                : msg
            )
          )
        }

        // answer 태그 찾기
        if (queue.thinkingEnded && !queue.answerStarted) {
          const answerIndex = queue.pendingContent.indexOf('<answer>')
          if (answerIndex >= 0) {
            queue.answerStarted = true
            queue.pendingContent = queue.pendingContent.slice(answerIndex + '<answer>'.length)
          } else if (!hasThinkingTag) {
            // thinking이 없으면 바로 answer로 처리
            queue.answerStarted = true
          }
        }

        // thinkingDone이 true이고 answerStarted가 true일 때만 content를 큐에 넣기
        // thinking이 완료되기 전에는 content를 큐에 넣지 않음
        if (queue.answerStarted && queue.thinkingDone) {
          const sanitized = queue.pendingContent
            .replace(/<\/?answer>/gi, '')
            .replace(/<\/?thinking>/gi, '')
          queue.pendingContent = ''
          if (sanitized) {
            queue.contentQueue.push(...sanitized.split(''))
          }
        } else if (queue.answerStarted && !hasThinkingTag && queue.thinkingEnded) {
          // thinking 태그가 없고 thinking이 끝났으면 바로 처리
          const sanitized = queue.pendingContent
            .replace(/<\/?answer>/gi, '')
            .replace(/<\/?thinking>/gi, '')
          queue.pendingContent = ''
          if (sanitized) {
            queue.contentQueue.push(...sanitized.split(''))
          }
        }
      }
      streamQueuesRef.current.set(id, queue)
      startStreamTimer(id)
    }

    const flushStreamQueue = (id: string) => {
      const queue = streamQueuesRef.current.get(id)
      if (!queue) return
      if (queue.timer) clearInterval(queue.timer)
      streamQueuesRef.current.delete(id)
    }

    // AbortController 생성
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageWithContext,
          conversationHistory: messagesRef.current,
          currentPath: pathname,
          currentHash: typeof window !== 'undefined' && window.location.hash ? window.location.hash.slice(1) : '',
          pageLanguage: language,
          ...(pendingOpenRef.current && { pendingOpen: pendingOpenRef.current })
        }),
        signal, // AbortSignal 추가
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        throw new Error(`Failed to get response: ${response.status} - ${errorText}`)
      }

      // 일반 JSON 응답 처리 (스트리밍이 아닌 경우)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const jsonData = await response.json()
        console.log('Received JSON response:', jsonData)
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { 
                ...msg, 
                content: jsonData.message || '응답을 받지 못했습니다.',
                sources: jsonData.sources || []
              }
            : msg
        ))
        return
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let finalAnswer = '' // 최종 답변 저장용

      if (!reader) {
        throw new Error('No reader available')
      }

      let chunkCount = 0
      while (true) {
        // 중단 신호 확인
        if (signal.aborted) {
          reader.cancel()
          break
        }
        
        const { done, value } = await reader.read()
        chunkCount++
        
        if (done) {
          // 스트림 완료 후 Analytics 저장
          const currentMessages = messagesRef.current
          const assistantIndex = currentMessages.findIndex(msg => msg.id === streamingMessageId)
          if (assistantIndex > 0) {
            const userMessage = currentMessages[assistantIndex - 1]
            if (userMessage && userMessage.role === 'user') {
              // 최종 답변 내용 가져오기
              const queue = streamQueuesRef.current.get(streamingMessageId)
              const finalAnswer = queue ? 
                (queue.contentQueue.join('') + queue.pendingContent) : 
                fullContent
              
              if (finalAnswer) {
                try {
                  const { getUserInfoForAnalytics } = await import('@/lib/user-analytics')
                  const userInfo = await getUserInfoForAnalytics()
                  const res = await fetch('/api/admin/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      question: userMessage.content,
                      answer: finalAnswer,
                      ...userInfo
                    })
                  })
                  if (!res.ok) {
                    const errBody = await res.text()
                    console.error('Analytics save failed', res.status, errBody)
                  }
                } catch (error) {
                  console.error('Failed to save analytics:', error)
                }
              }
            }
          }
          
          break
        }
        
        // 중단 신호 확인 (읽기 후에도)
        if (signal.aborted) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'content') {
                // thinking이 있으면 즉시 메시지에 업데이트 (큐 시스템 무시)
                if (parsed.thinking !== undefined && parsed.thinking !== null) {
                  const thinkingText = typeof parsed.thinking === 'string' ? parsed.thinking : String(parsed.thinking)
                  const done = parsed.thinkingDone === true
                  pendingThinkingRef.current = { id: streamingMessageId, text: thinkingText, thinkingDone: done }
                  const flushThinking = () => {
                    const p = pendingThinkingRef.current
                    if (!p) return
                    lastThinkingFlushAtRef.current = Date.now()
                    setMessages(prev => prev.map(msg => msg.id === p.id ? { ...msg, thinking: p.text, thinkingDone: p.thinkingDone } : msg))
                  }
                  if (thinkingFlushTimerRef.current) {
                    clearTimeout(thinkingFlushTimerRef.current)
                    thinkingFlushTimerRef.current = null
                  }
                  flushThinking()
                }
                
                // content가 있으면 즉시 업데이트 (큐 시스템 무시)
                if (parsed.content !== undefined && parsed.content !== null && parsed.content.length > 0) {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === streamingMessageId
                        ? { 
                            ...msg, 
                            content: parsed.content || msg.content || ''
                          }
                      : msg
                    )
                  )
                }
                
                // thinkingDone 상태 업데이트
                if (parsed.thinkingDone) {
                  if (thinkingFlushTimerRef.current) {
                    clearTimeout(thinkingFlushTimerRef.current)
                    thinkingFlushTimerRef.current = null
                  }
                  const queue = streamQueuesRef.current.get(streamingMessageId)
                  if (queue) {
                    queue.thinkingDone = true
                    streamQueuesRef.current.set(streamingMessageId, queue)
                  }
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === streamingMessageId
                        ? { ...msg, thinkingDone: true }
                        : msg
                    )
                  )
                }
                
                // deltaContent는 큐에 추가 (점진적 업데이트용)
                if (parsed.deltaContent) {
                  enqueueStreamDelta(streamingMessageId, parsed.deltaContent, undefined)
                }
              } else if (parsed.type === 'done') {
                if (thinkingFlushTimerRef.current) {
                  clearTimeout(thinkingFlushTimerRef.current)
                  thinkingFlushTimerRef.current = null
                }
                pendingThinkingRef.current = null
                // 큐 정리
                const queue = streamQueuesRef.current.get(streamingMessageId)
                if (queue) {
                  queue.sources = parsed.sources || []
                  queue.thinkingDone = true
                  queue.done = true
                  streamQueuesRef.current.set(streamingMessageId, queue)
                  // 큐 타이머 정리
                  if (queue.timer) {
                    clearInterval(queue.timer)
                    queue.timer = undefined
                  }
                }
                
                let finalContent = parsed.content || ''
                const finalThinking =
                  typeof parsed.thinking === 'string'
                    ? parsed.thinking
                    : parsed.thinking != null
                      ? String(parsed.thinking)
                      : ''
                const finalSources = parsed.sources || []
                // [OFFERED_LINK: ...] 마커는 표시에서만 제거 (portfolio면 pendingOpen, /resume 포함 모든 경로 제거)
                const offeredLinkMatch = finalContent.match(/\[OFFERED_LINK:\s*([^\]]+)\]/)
                if (offeredLinkMatch) {
                  const path = offeredLinkMatch[1].trim()
                  if (path.startsWith('/portfolio/')) {
                    const [pathPart, hashPart] = path.split('#')
                    const projectId = pathPart.replace(/^\/portfolio\//, '').trim()
                    const anchor = hashPart?.trim() || undefined
                    if (projectId) pendingOpenRef.current = { projectId, anchor }
                  }
                  finalContent = finalContent
                    .replace(/\s*<p>\s*\[OFFERED_LINK:[^<]*<\/p>\s*/gi, '')
                    .replace(/\s*\[OFFERED_LINK:[^\]]+\]\s*/g, '')
                    .trim()
                }

                // [OPEN_LINK: /portfolio/...] 파싱 → 실제 이동 + 표시용에서 제거 (이력서는 페이지 없음, 다운로드만)
                const openLinkMatch = finalContent.match(/\[OPEN_LINK:\s*(\/portfolio\/[^\]]+)\]/)
                let openPath: string | null = null
                if (openLinkMatch) {
                  openPath = openLinkMatch[1].trim()
                  finalContent = finalContent
                    .replace(/\s*<p>\s*\[OPEN_LINK:[^<]*<\/p>\s*/gi, '')
                    .replace(/\s*\[OPEN_LINK:[^\]]+\]\s*/g, '')
                    .trim()
                }
                // [OPEN_TEL: +82-10-2852-9692] → 전화 걸기
                const openTelMatch = finalContent.match(/\[OPEN_TEL:\s*([^\]]+)\]/)
                if (openTelMatch) {
                  const tel = openTelMatch[1].trim()
                  if (typeof window !== 'undefined' && tel) {
                    window.location.href = `tel:${tel}`
                  }
                  finalContent = finalContent
                    .replace(/\s*<p>\s*\[OPEN_TEL:[^<]*<\/p>\s*/gi, '')
                    .replace(/\s*\[OPEN_TEL:[^\]]+\]\s*/g, '')
                    .trim()
                }
                // [OPEN_MAILTO: email] → 메일 앱 열기
                const openMailtoMatch = finalContent.match(/\[OPEN_MAILTO:\s*([^\]]+)\]/)
                if (openMailtoMatch) {
                  const email = openMailtoMatch[1].trim()
                  if (typeof window !== 'undefined' && email) {
                    window.location.href = `mailto:${email}`
                  }
                  finalContent = finalContent
                    .replace(/\s*<p>\s*\[OPEN_MAILTO:[^<]*<\/p>\s*/gi, '')
                    .replace(/\s*\[OPEN_MAILTO:[^\]]+\]\s*/g, '')
                    .trim()
                }
                // [DOWNLOAD_RESUME: lang] → 이력서 PDF 다운로드 (먼저 토큰 제거 후 새 탭에서 열어 현재 페이지 유지)
                const downloadResumeMatch = finalContent.match(/\[DOWNLOAD_RESUME:\s*([^\]]+)\]/)
                if (downloadResumeMatch) {
                  const lang = downloadResumeMatch[1].trim().toLowerCase()
                  finalContent = finalContent
                    .replace(/\s*<p>\s*\[DOWNLOAD_RESUME:[^<]*<\/p>\s*/gi, '')
                    .replace(/\s*\[DOWNLOAD_RESUME:[^\]]+\]\s*/g, '')
                    .trim()
                  if (typeof window !== 'undefined' && ['en', 'ko', 'it'].includes(lang)) {
                    const a = document.createElement('a')
                    a.href = `/api/resume/download?lang=${lang}`
                    a.target = '_blank'
                    a.rel = 'noopener noreferrer'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                  }
                }
                // 표시 텍스트에서 Mailto: 제거 (전각 콜론 포함, 마크다운 링크 텍스트 [Mailto:email](mailto:...) → [email](mailto:...))
                const mailtoColon = '[:\uFF1A]'
                const mailtoEmail = '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})'
                finalContent = finalContent
                  .replace(new RegExp(`\\[\s*(?:Mailto|mailto|MAILTO)\\s*${mailtoColon}\\s*${mailtoEmail}\\s*\\]`, 'gi'), '[$1]') // 링크 텍스트
                  .replace(new RegExp(`(?:[Mm]ailto|MAILTO)\\s*${mailtoColon}\\s*${mailtoEmail}`, 'gi'), '$1')
                  .replace(new RegExp(`(?:Mailto|mailto|MAILTO)\\s*${mailtoColon}\\s*`, 'gi'), '')
                // AI가 [OPEN_LINK]를 안 썼지만 짧은 인사(안내해드릴게요 등)면 pendingOpenRef로 이동
                if (!openPath && pendingOpenRef.current) {
                  const text = (finalContent || '').replace(/<[^>]+>/g, ' ').trim()
                  const looksLikeAck = text.length < 500 && (
                    /안내해드릴게요|안내해드렸습니다|열었어요|Opened|Taken you there|Ti ho guidato|이동시켜 드릴게요/i.test(text)
                  )
                  if (looksLikeAck) {
                    const { projectId, anchor } = pendingOpenRef.current
                    openPath = `/portfolio/${projectId}${anchor ? `#${anchor}` : ''}`
                  }
                }
                if (openPath) {
                  pendingOpenRef.current = null
                  const win = typeof window !== 'undefined' ? window : null
                  if (win && win.innerWidth <= 743) {
                    closeChatBot()
                    try { localStorage.setItem('chatbot-is-open', 'false') } catch { /* ignore */ }
                  }
                  if (win) {
                    const currentPath = win.location.pathname
                    const currentHash = win.location.hash.slice(1)
                    const [targetPath, targetHashPart] = openPath.includes('#') ? [openPath.split('#')[0], openPath.slice(openPath.indexOf('#') + 1)] : [openPath.replace(/#.*$/, ''), '']
                    const samePath = currentPath === targetPath
                    const sameHash = !targetHashPart || currentHash === targetHashPart
                    if (samePath && targetHashPart) {
                      // 같은 페이지에서 hash만 바꿀 땐 full reload 없이 hash만 변경 → hashchange로 스크롤/하이라이트 동작
                      if (sameHash) {
                        win.location.hash = ''
                        setTimeout(() => { win.location.hash = targetHashPart }, 0)
                      } else {
                        win.location.hash = targetHashPart
                      }
                    } else if (!samePath || !sameHash) {
                      win.location.href = openPath
                    }
                  }
                }
                
                setMessages(prev => prev.map(msg => {
                  if (msg.id !== streamingMessageId) return msg
                  return {
                    ...msg,
                    thinking: finalThinking || msg.thinking || '',
                    thinkingDone: true,
                    sources: finalSources,
                    content: finalContent || msg.content || ''
                  }
                }))
                
                streamQueuesRef.current.delete(streamingMessageId)
                
                // 최종 답변 저장 (분석용)
                finalAnswer = parsed.content || fullContent
                
                // Analytics 저장은 스트림 완료 후 처리
              } else if (parsed.type === 'error') {
                flushStreamQueue(streamingMessageId)
                setMessages(prev => prev.map(msg => 
                  msg.id === streamingMessageId 
                    ? { ...msg, content: parsed.content || '오류가 발생했습니다. 다시 시도해주세요.' }
                    : msg
                ))
                break
              }
            } catch (e) {
              // JSON 파싱 실패는 무시
              console.warn('Failed to parse SSE data:', e)
            }
          }
        }
      }
    } catch (error) {
      // AbortError는 정상적인 중단 → 로더+shimmer 제거를 위해 thinkingDone: true, 플레이스홀더 thinking 비우기
      if (error instanceof Error && error.name === 'AbortError') {
        flushStreamQueue(streamingMessageId)
        setMessages(prev => prev.map(msg => {
          if (msg.id !== streamingMessageId) return msg
          const t = typeof msg.thinking === 'string' ? msg.thinking.trim() : ''
          const clearThinking = !t || /^\.+$/.test(t)
          return {
            ...msg,
            content: msg.content || '응답을 중단했습니다',
            thinkingDone: true,
            thinking: clearThinking ? '' : msg.thinking
          }
        }))
      } else {
        console.error('Error:', error)
        flushStreamQueue(streamingMessageId)
        setMessages(prev => prev.map(msg => {
          if (msg.id !== streamingMessageId) return msg
          const t = typeof msg.thinking === 'string' ? msg.thinking.trim() : ''
          const clearThinking = !t || /^\.+$/.test(t)
          return {
            ...msg,
            content: '오류가 발생했어요. 다시 시도해 주세요. 🥲',
            thinkingDone: true,
            thinking: clearThinking ? '' : msg.thinking
          }
        }))
      }
    } finally {
      if (thinkingFlushTimerRef.current) {
        clearTimeout(thinkingFlushTimerRef.current)
        thinkingFlushTimerRef.current = null
      }
      setIsLoading(false)
      abortControllerRef.current = null
      isSendingRef.current = false // 전송 완료 표시
    }
  }, [chatInput, pathname, selectedTextChip, setSelectedTextChip, isLoading, setChatInput]) // messages는 useRef로 참조하므로 dependency에서 제거

  // 스트리밍 중단 함수
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
    if (thinkingFlushTimerRef.current) {
      clearTimeout(thinkingFlushTimerRef.current)
      thinkingFlushTimerRef.current = null
    }
    // 모든 스트림 큐 정리
    streamQueuesRef.current.forEach((queue, id) => {
      if (queue.timer) clearInterval(queue.timer)
    })
    streamQueuesRef.current.clear()
  }, [])

  // Context에 sendMessage 함수 등록
  useEffect(() => {
    if (!setSendMessage || !isMounted) return
    
    setSendMessage(handleSend)
    return () => {
      if (setSendMessage) {
        setSendMessage(() => {})
      }
    }
  }, [isMounted, setSendMessage, handleSend])

  // 프로젝트 상세 페이지에서 자동으로 프로젝트 요약 (중복 호출 방지)
  useEffect(() => {
    if (!autoSummarize || !projectId || hasAutoSummarizedRef.current[projectId]) {
      return
    }
    
    hasAutoSummarizedRef.current[projectId] = true
    // 약간의 지연 후 자동 요약 요청
    const timeoutId = setTimeout(() => {
      handleSend(`이 프로젝트에 대해 요약해줘`)
    }, 500)
    
    // cleanup 함수로 timeout 정리
    return () => clearTimeout(timeoutId)
  }, [autoSummarize, projectId, handleSend])

  const handleSourceClick = (source: { id: string; title: string; anchor?: string }) => {
    if (source.anchor) {
      const element = document.getElementById(source.anchor)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      // Navigate to project page if needed
      window.location.href = `/portfolio/${source.id}`
    }
  }

  /** DOM 내 모든 텍스트 노드에서 "Mailto:" 접두사 제거 (href는 건드리지 않음) */
  const stripMailtoFromTextNodes = (root: Node) => {
    const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null)
    if (!doc) return
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    const toReplace: { node: Text; newText: string }[] = []
    let textNode: Text | null
    while ((textNode = walker.nextNode() as Text | null)) {
      const text = textNode.textContent || ''
      const cleaned = text.replace(/(?:Mailto|mailto|MAILTO)\s*[:\uFF1A]\s*/gi, '')
      if (cleaned !== text) toReplace.push({ node: textNode, newText: cleaned })
    }
    toReplace.forEach(({ node, newText }) => { node.textContent = newText })
  }

  const renderMarkdown = (markdown: string) => {
    if (!markdown) return ''
    
    // marked 옵션 설정
    marked.setOptions({
      breaks: true, // 줄바꿈을 <br>로 변환
      gfm: true, // GitHub Flavored Markdown 활성화
    })
    
    return marked.parse(markdown) as string
  }

  const handleMarkdownClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const link = target.closest('a')
    if (!link) return
    const href = link.getAttribute('href')
    if (!href) return
    if (href.startsWith('/')) {
      event.preventDefault()
      window.location.href = href
    }
  }

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]))
  }, [projects])

  // 현재 페이지 제목 및 썸네일 가져오기
  const getCurrentPageInfo = useCallback(() => {
    if (!pathname) return { title: null, thumbnail: null }
    
    // 포트폴리오 상세 페이지인 경우
    const projectMatch = pathname.match(/\/portfolio\/([^\/]+)/)
    if (projectMatch) {
      const currentProjectId = projectMatch[1]
      const project = projectMap.get(currentProjectId)
      if (project && project.title) {
        // 프로젝트 제목에서 "RAG Chat Builder - " 같은 prefix 제거
        const title = project.title.includes(' - ') 
          ? project.title.split(' - ').slice(1).join(' - ')
          : project.title
        return { title, thumbnail: project.thumbnail || null }
      }
      return { title: 'Portfolio', thumbnail: null }
    }
    
    // 다른 페이지들
    if (pathname === '/portfolio') return { title: 'Portfolio', thumbnail: null }
    if (pathname === '/resume') return { title: 'Resume', thumbnail: null }
    if (pathname.startsWith('/admin')) return { title: 'Admin', thumbnail: null }
    
    return { title: null, thumbnail: null }
  }, [pathname, projectMap])

  const getMessageProjects = useCallback((sources?: Message['sources']) => {
    if (!sources || sources.length === 0) return []
    const uniqueIds = new Set<string>()
    const previews: ProjectPreview[] = []

    sources.forEach((source) => {
      const rawId = source.projectId || source.id
      if (!rawId || rawId === 'resume') return
      if (uniqueIds.has(rawId)) return
      uniqueIds.add(rawId)

      const mapped = projectMap.get(rawId)
      if (mapped) {
        previews.push(mapped)
      } else {
        previews.push({
          id: rawId,
          title: source.title,
        })
      }
    })

    return previews
  }, [projectMap])

  return (
    <div className="h-full flex flex-col" data-no-text-selection="true" style={{ backgroundColor: 'var(--greyscale-700)' }}>
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--fill-white-10)' }}>
        {/* Left side icons */}
        <div className="flex items-center gap-2">
          {/* Layout/View icon - Collapse chatbot */}
          <Tooltip text="Collapse">
            <button
              onClick={closeChatBot}
              className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors group"
              style={{ color: 'var(--text-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </Tooltip>
          
          {/* Chat History icon with dropdown */}
          <div className="relative inline-flex shrink-0" ref={historyDropdownRef}>
            <Tooltip text="Chat History">
              <button
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                className="inline-flex shrink-0 items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors group"
                style={{ color: 'var(--text-primary)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 5V8L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </Tooltip>
            
            {/* History Dropdown */}
            {isHistoryOpen && (
              <div 
                className="absolute top-full left-0 mt-2 z-50 scrollbar-transparent-hover"
                style={{ 
                  display: 'flex',
                  width: '240px',
                  padding: '8px',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  borderRadius: '16px',
                  border: '1px solid var(--dropdown-border, rgba(255, 255, 255, 0.20))',
                  background: 'var(--dropdown-body, #121313)',
                  boxShadow: '0 0 20px 0 rgba(255, 255, 255, 0.04)',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ width: '100%' }}>
                  {chatHistory.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <span className="text-sm text-white/70">No chat history</span>
                    </div>
                  ) : (
                    chatHistory.map((history) => (
                      <ChatHistoryItem
                        key={history.id}
                        id={history.id}
                        title={history.title}
                        isActive={currentHistoryId === history.id}
                        onClick={() => loadHistory(history.id)}
                        onDelete={deleteHistory}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* New Chat button */}
          <Tooltip text="New Chat">
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Right side icons */}
        <div className="flex items-center gap-2">
          {/* Close button */}
          <Tooltip text="Close" position="bottom">
            <button
              onClick={closeChatBot}
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-transparent-hover" style={{ padding: '16px' }}>
        {messages.length === 0 && isMounted && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 0 }}>
            <div style={{ width: '100%', maxWidth: '100%' }} className="chatbot-prose">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(t('chatbot.greeting') || '') }} />
            </div>
          </div>
        )}
        {messages.map((message, index) => (
          <div
            key={message.id}
            style={{ 
              display: 'flex', 
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: index < messages.length - 1 ? '24px' : '0'
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%' }}>
              {/* Thinking Process (아코디언) - 위에 표시 */}
              {(() => {
                if (message.role !== 'assistant') return null
                
                const isLastMessage = message.id === messages[messages.length - 1]?.id
                const isStreamingThis = isLoading && isLastMessage
                const rawThinking = typeof message.thinking === 'string' ? message.thinking : ''
                const isPlaceholderOnly = rawThinking.trim() === '' || /^\.+$/.test(rawThinking.trim()) || rawThinking.trim() === '...'
                const hasThinkingContent = rawThinking.length > 0 && !isPlaceholderOnly
                // 로더/쉬머는 실제 스트리밍 중일 때만. New Chat 후 greeting에는 표시 안 함.
                const hasThinking = hasThinkingContent || (isStreamingThis && !message.thinkingDone)
                
                if (!hasThinking) return null
                
                const isActiveMessage = Boolean(
                  isStreamingThis ||
                  (!message.thinkingDone && isLastMessage)
                )
                const thinkingValue = isPlaceholderOnly ? '' : rawThinking
                const contentPending = isLastMessage && (message.thinkingDone || false) && (message.content === '' || message.content === undefined)
                
                return (
                  <ThinkingAccordion
                    thinking={typeof thinkingValue === 'string' ? thinkingValue : ''}
                    isActive={isActiveMessage}
                    thinkingDone={message.thinkingDone || false}
                    contentPending={contentPending}
                  />
                )
              })()}
              
              {/* User Message */}
              {message.role === 'user' && message.content && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', width: '100%' }}>
                  {editingMessageId === message.id ? (
                    // Edit Mode
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'flex-end' }}>
                      {/* 드래그한 텍스트 표시 */}
                      {message.selectedText && (
                        <div style={{ marginBottom: '0px' }}>
                          <SelectedTextChip selectedText={message.selectedText} />
                        </div>
                      )}
                      <input
                        type="text"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (!editInput?.trim()) return
                            
                            // 메시지 업데이트 및 해당 메시지 이후의 모든 메시지 제거
                            const messageIndex = messages.findIndex(msg => msg.id === message.id)
                            let updatedMessages: Message[] = []
                            setMessages(prev => {
                              const updated = prev.map(msg => 
                                msg.id === message.id 
                                  ? { ...msg, content: editInput }
                                  : msg
                              )
                              // 편집된 메시지 이후의 모든 메시지 제거
                              updatedMessages = updated.slice(0, messageIndex + 1)
                              // ref를 즉시 업데이트하여 API 호출 시 최신 메시지 사용
                              messagesRef.current = updatedMessages
                              return updatedMessages
                            })
                            
                            setEditingMessageId(null)
                            const editedContent = editInput
                            setEditInput('')
                            
                            // 수정된 메시지로 다시 전송 (편집 모드이므로 skipUserMessage: true)
                            await handleSend(editedContent, true)
                          }
                          if (e.key === 'Escape') {
                            setEditingMessageId(null)
                            setEditInput('')
                          }
                        }}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '16px',
                          borderRadius: '16px',
                          background: 'var(--chat-user-messageBody, rgba(255, 255, 255, 0.10))',
                          color: 'var(--text-primary, #FFF)',
                          fontFamily: '"Pretendard Variable", sans-serif',
                          fontSize: '14px',
                          fontStyle: 'normal',
                          fontWeight: 400,
                          lineHeight: '160%',
                          border: 'none',
                          outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingMessageId(null)
                            setEditInput('')
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.10)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '24px',
                            background: 'transparent',
                            border: '1px solid #FFFFFF',
                            color: '#FFFFFF',
                            fontFamily: '"Galmuri", monospace',
                            fontSize: '13px',
                            fontWeight: 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!editInput?.trim()) return
                            
                            // 메시지 업데이트 및 해당 메시지 이후의 모든 메시지 제거
                            const messageIndex = messages.findIndex(msg => msg.id === message.id)
                            let updatedMessages: Message[] = []
                            setMessages(prev => {
                              const updated = prev.map(msg => 
                                msg.id === message.id 
                                  ? { ...msg, content: editInput }
                                  : msg
                              )
                              // 편집된 메시지 이후의 모든 메시지 제거
                              updatedMessages = updated.slice(0, messageIndex + 1)
                              // ref를 즉시 업데이트하여 API 호출 시 최신 메시지 사용
                              messagesRef.current = updatedMessages
                              return updatedMessages
                            })
                            
                            setEditingMessageId(null)
                            const editedContent = editInput
                            setEditInput('')
                            
                            // 수정된 메시지로 다시 전송 (편집 모드이므로 skipUserMessage: true)
                            await handleSend(editedContent, true)
                          }}
                          onMouseEnter={(e) => {
                            if (editInput?.trim()) {
                              e.currentTarget.style.background = 'var(--button-hovered, #E6E6E6)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (editInput?.trim()) {
                              e.currentTarget.style.background = 'var(--button-primary, #ffffff)'
                            }
                          }}
                          disabled={!editInput?.trim()}
                          style={{
                            padding: '12px 16px',
                            borderRadius: '24px',
                            background: editInput?.trim() ? 'var(--button-primary, #ffffff)' : 'var--(button-disabled, rgba(255, 255, 255, 0.08))',
                            border: 'none',
                            color: editInput?.trim() ? 'var(--text-secondary, #222424)' : 'var(--text-disabled, #838383)',
                            fontFamily: 'GalmuriMono9, monospace',
                            fontSize: '13px',
                            fontWeight: 400,
                            cursor: editInput?.trim() ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s ease',
                            opacity: editInput?.trim() ? 1 : 1
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Normal View
                    <>
                      {/* 드래그한 텍스트 표시 */}
                      {message.selectedText && (
                        <div style={{ alignSelf: 'flex-end' }}>
                          <SelectedTextChip selectedText={message.selectedText} />
                        </div>
                      )}
                      <div
                        style={{
                          padding: '16px',
                          borderRadius: '16px',
                          background: 'var(--chat-user-messageBody, rgba(255, 255, 255, 0.10))',
                          color: 'var(--text-primary, #FFF)',
                          fontFamily: '"Pretendard Variable", sans-serif',
                          fontSize: '14px',
                          fontStyle: 'normal',
                          fontWeight: 400,
                          lineHeight: '160%',
                          maxWidth: '100%',
                          wordBreak: 'break-word',
                          alignSelf: 'flex-end'
                        }}
                      >
                        {message.content}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start', width: 'fit-content', marginLeft: 'auto' }}>
                        <Tooltip text="Edit">
                          <button
                            onClick={() => {
                              setEditingMessageId(message.id)
                              setEditInput(message.content)
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: 'var(--text-primary, #FFF)'
                            }}
                            aria-label="Edit"
                          >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M11.05 3.00002L4.20835 10.2417C3.95002 10.5167 3.70002 11.0584 3.65002 11.4334L3.34169 14.1334C3.23335 15.1084 3.93335 15.775 4.90002 15.6084L7.58335 15.15C7.95835 15.0834 8.48335 14.8084 8.74169 14.525L15.5834 7.28335C16.7667 6.03335 17.3 4.60835 15.4584 2.86668C13.625 1.14168 12.2334 1.75002 11.05 3.00002Z" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              <path d="M9.90833 4.20831C10.2667 6.50831 12.1333 8.36665 14.45 8.69998" stroke="currentColor" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                          </button>
                        </Tooltip>
                        <Tooltip text={copiedMessageId === message.id ? "Copied" : "Copy"}>
                          <button
                            onClick={async () => {
                              try {
                                // Clipboard API 사용 (HTTPS 환경)
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                  await navigator.clipboard.writeText(message.content)
                                } else {
                                  // 폴백: 구식 방법 (HTTP 환경)
                                  const textArea = document.createElement('textarea')
                                  textArea.value = message.content
                                  textArea.style.position = 'fixed'
                                  textArea.style.left = '-999999px'
                                  textArea.style.top = '-999999px'
                                  document.body.appendChild(textArea)
                                  textArea.focus()
                                  textArea.select()
                                  try {
                                    document.execCommand('copy')
                                  } catch (err) {
                                    console.error('Fallback copy failed:', err)
                                  }
                                  document.body.removeChild(textArea)
                                }
                                // 복사 성공 피드백: 체크 아이콘 표시
                                setCopiedMessageId(message.id)
                                // 2초 후 원래 아이콘으로 복귀
                                setTimeout(() => {
                                  setCopiedMessageId(null)
                                }, 2000)
                              } catch (err) {
                                console.error('Failed to copy:', err)
                              }
                            }}
                            style={{
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: 'var(--text-primary, #FFF)'
                            }}
                            aria-label={copiedMessageId === message.id ? "Copied" : "Copy"}
                          >
                            {copiedMessageId === message.id ? (
                              // 체크 아이콘
                              <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              borderRadius: '24px',
                              background: 'var(--dropdownList-hovered, rgba(255, 255, 255, 0.10))',
                              width: '20px',
                              height: '20px',
                              padding: '4px',
                              }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
  <path d="M11.25 2.25L4.03125 9.75L0.75 6.34091" stroke="#72C1DB" strokeLinecap="round" strokeLinejoin="round"/>
</svg>
                              </div>
                            ) : (
                              // 복사 아이콘
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16.6667 7.5H9.16667C8.25 7.5 7.5 8.25 7.5 9.16667V16.6667C7.5 17.5833 8.25 18.3333 9.16667 18.3333H16.6667C17.5833 18.3333 18.3333 17.5833 18.3333 16.6667V9.16667C18.3333 8.25 17.5833 7.5 16.6667 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                <path d="M4.16667 12.5H3.33333C2.89131 12.5 2.46738 12.3244 2.15482 12.0118C1.84226 11.6993 1.66667 11.2754 1.66667 10.8333V3.33333C1.66667 2.89131 1.84226 2.46738 2.15482 2.15482C2.46738 1.84226 2.89131 1.66667 3.33333 1.66667H10.8333C11.2754 1.66667 11.6993 1.84226 12.0118 2.15482C12.3244 2.46738 12.5 2.89131 12.5 3.33333V4.16667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Assistant Message Content 표시 - 마크다운 렌더링 및 출처를 인라인 링크로 변환 (환영 메시지 id '1' 또는 thinking 없음 → 표시) */}
              {message.role === 'assistant' && message.content && (message.id === '1' || message.thinkingDone !== false || !message.thinking) && (
                <div 
                  style={{
                    marginTop: message.thinking ? '12px' : '0',
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                  className="chatbot-prose"
                >
                  {(() => {
                    // 출처를 인라인 링크로 변환한 후 마크다운 렌더링
                    const sourcesMap = message.sources && message.sources.length > 0
                      ? new Map(message.sources.map(s => [s.title, s]))
                      : new Map()
                    
                    // 프로젝트 제목으로 ID를 찾기 위한 역맵 생성
                    const titleToIdMap = new Map<string, string>()
                    projectMap.forEach((project, id) => {
                      // 전체 제목과 prefix 제거한 제목 모두 매핑
                      if (project.title) {
                        titleToIdMap.set(project.title, id)
                        if (project.title.includes(' - ')) {
                          const titleWithoutPrefix = project.title.split(' - ').slice(1).join(' - ')
                          titleToIdMap.set(titleWithoutPrefix, id)
                        }
                      }
                    })
                    
                    let content = message.content
                      // 모델이 잘못 출력한 태그 조각 제거
                      .replace(/<\/?answer[^>]*>/gi, '')
                      .replace(/<\/?thinking[^>]*>/gi, '')
                      .replace(/<\/?answer[^>]*$/gim, '')
                      .replace(/<\/?thinking[^>]*$/gim, '')
                      // Mailto: 제거 (마크다운 링크 텍스트 [Mailto:email] → [email], 일반 텍스트도 제거)
                      .replace(/\[\s*(?:Mailto|mailto|MAILTO)\s*[:\uFF1A]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*\]/gi, '[$1]')
                      .replace(/(?:[Mm]ailto|MAILTO)\s*[:\uFF1A]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, '$1')
                      .replace(/(?:Mailto|mailto|MAILTO)\s*[:\uFF1A]\s*/gi, '')
                      // 토큰 마커는 사용자에게 노출하지 않음 (스트림 타이밍 등으로 남아 있어도 표시에서 제거)
                      .replace(/\s*<p>\s*\[(?:OFFERED_LINK|OPEN_LINK|OPEN_TEL|OPEN_MAILTO|DOWNLOAD_RESUME):[^<]*<\/p>\s*/gi, '')
                      .replace(/\s*\[OFFERED_LINK:[^\]]+\]\s*/g, '')
                      .replace(/\s*\[OPEN_LINK:[^\]]+\]\s*/g, '')
                      .replace(/\s*\[OPEN_TEL:[^\]]+\]\s*/g, '')
                      .replace(/\s*\[OPEN_MAILTO:[^\]]+\]\s*/g, '')
                      .replace(/\s*\[DOWNLOAD_RESUME:[^\]]+\]\s*/g, '')
                    const sourcePattern = /\[Source:\s*([^\]]+)\]/g
                    
                    // href별로 번호·표시 텍스트 매핑 (프로젝트 상세에서는 앵커일 때 섹션 제목 표시)
                    const hrefToNumber = new Map<string, number>()
                    const hrefToFirstTitle = new Map<string, string>()
                    const hrefToDisplayText = new Map<string, string>()
                    let linkCounter = 1
                    const isProjectDetailPage = pathname?.startsWith('/portfolio/') && pathname !== '/portfolio'
                    const currentProjectId = pathname?.match(/^\/portfolio\/([^/]+)/)?.[1]
                    
                    const getChipTextFromHref = (href: string): string => {
                      const pathMatch = href.match(/\/portfolio\/([^#]+)/)
                      const segment = pathMatch ? pathMatch[1].replace(/-/g, ' ') : href.replace(/^\//, '').split('#')[0].replace(/-/g, ' ')
                      return segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ''
                    }
                    
                    const allMatches: Array<{ index: number; sourceTitle: string; href: string; originalMatch: string; displayText: string }> = []
                    let match
                    
                    while ((match = sourcePattern.exec(content)) !== null) {
                      const sourceTitle = match[1].trim()
                      let href = ''
                      let displayText = sourceTitle
                      
                      const source = sourcesMap.get(sourceTitle)
                      if (source) {
                        const isResume = source.type === 'resume' || source.id === 'resume' || !source.projectId
                        const baseUrl = isResume ? '/resume' : `/portfolio/${source.id}`
                        const hasAnchor = source.anchor || source.headingIndex != null
                        const hash = source.headingIndex != null
                          ? `#heading-${source.headingIndex}`
                          : source.anchor ? `#${source.anchor}` : ''
                        
                        if (!isResume && isProjectDetailPage && currentProjectId && source.projectId === currentProjectId && hasAnchor) {
                          href = `${baseUrl}${hash}`
                          displayText = source.title.includes(' - ') ? source.title.split(' - ').slice(1).join(' - ').trim() : source.title
                        } else {
                          href = hash ? `${baseUrl}${hash}` : baseUrl
                          displayText = !isProjectDetailPage && source.title.includes(' - ')
                            ? source.title.split(' - ')[0].trim()
                            : source.title
                        }
                      } else {
                        const projectId = titleToIdMap.get(sourceTitle)
                        if (projectId) {
                          href = `/portfolio/${projectId}`
                        } else if (projectMap.has(sourceTitle)) {
                          href = `/portfolio/${sourceTitle}`
                        }
                        displayText = sourceTitle
                      }
                      
                      if (href) {
                        allMatches.push({ index: match.index!, sourceTitle, href, originalMatch: match[0], displayText })
                        if (!hrefToNumber.has(href)) {
                          hrefToNumber.set(href, linkCounter)
                          hrefToFirstTitle.set(href, sourceTitle)
                          hrefToDisplayText.set(href, displayText)
                          linkCounter++
                        }
                      }
                    }
                    
                    allMatches.reverse().forEach(({ index, href, originalMatch, displayText }) => {
                      content = content.substring(0, index) + `[${displayText}](${href})` + content.substring(index + originalMatch.length)
                    })
                    
                    ;(message as any).__linkNumbers = hrefToNumber
                    
                    const html = renderMarkdown(content)
                    
                    let finalHtml = html
                    if (typeof window !== 'undefined') {
                      const parser = new DOMParser()
                      const doc = parser.parseFromString(html, 'text/html')
                      const links = doc.querySelectorAll('a')
                      
                      const mailtoEmailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
                      links.forEach((link) => {
                        const href = link.getAttribute('href') || ''
                        let chipText = hrefToDisplayText.get(href) ?? getChipTextFromHref(href)
                        // mailto: 링크는 href에서 이메일만 추출해 주소만 표시 (Mailto: 절대 노출 안 함)
                        if (/^mailto:/i.test(href)) {
                          const emailOnly = href.match(mailtoEmailRe)?.[0]
                          chipText = emailOnly ?? (href.replace(/^mailto:\s*/i, '').replace(/^(?:Mailto|mailto|MAILTO)\s*[:\uFF1A]\s*/gi, '').trim() || chipText)
                        }
                        link.setAttribute('class', 'chatbot-link-chip')
                        link.setAttribute('data-href', href)
                        link.textContent = chipText
                      })
                      // 모든 텍스트 노드에서 Mailto: 제거 (<strong>, <p>, <a> 내부 등 전부)
                      stripMailtoFromTextNodes(doc.body)
                      finalHtml = doc.body.innerHTML
                    }
                    
                    return (
                      <div>
                        <div
                          onClick={handleMarkdownClick}
                          dangerouslySetInnerHTML={{ __html: finalHtml }}
                        />
                        {isLoading && message.id === messages[messages.length - 1]?.id && (
                          <span 
                            style={{
                              display: 'inline-block',
                              marginLeft: '4px',
                              height: '14px',
                              width: '6px',
                              borderRadius: '2px',
                              backgroundColor: 'var(--text-secondary)',
                              animation: 'pulse 1.5s ease-in-out infinite'
                            }}
                          />
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
              
            </div>
          </div>
        ))}
        {/* 로딩 중일 때는 마지막 메시지의 thinking이 표시되므로 별도 loader 불필요 */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0" style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        marginLeft: '16px',
        marginRight: '16px',
        marginBottom:'16px',
      }}>
        {/* Selected Text Chip - 항상 인풋창 위에 떠있음 (thumbnail + title은 항상 표시) */}
        {(() => {
          const pageInfo = getCurrentPageInfo()
          // thumbnail과 title이 있거나 selectedTextChip이 있으면 chip 표시
          if (!pageInfo.title && !selectedTextChip) return null
          
          return (
            <div style={{ 
              display: 'flex',
              width: '100%',
              flexDirection: 'column',
              alignItems: 'flex-start',
              borderRadius: '16px 16px 0px 0px',
              border: '1px solid var(--fillWhite-10, rgba(255, 255, 255, 0.10))',
              borderBottom: 'none',
              background: 'var(--fillWhite-4, rgba(255, 255, 255, 0.04))',
              backdropFilter: 'blur(10px)',
              marginBottom: '-24px',
              zIndex: 1,
              position: 'relative',
              paddingLeft: '8px',
              paddingRight: '8px',
              paddingBottom: '24px',
              
            }}>
              {/* Current Page Info - 항상 표시 */}
              {pageInfo.title && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  width: '100%',
                  paddingBottom:'8px',
                  paddingTop: '8px',
                }}>
                  {/* Thumbnail */}
                  {pageInfo.thumbnail && (
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '8px',
                      backgroundImage: `url(${pageInfo.thumbnail})`,
                      backgroundSize: 'cover',
                      backgroundPosition: '50%',
                      backgroundRepeat: 'no-repeat',
                      backgroundColor: 'lightgray',
                      flexShrink: 0
                    }} />
                  )}
                  {/* Title */}
                  <span style={{
                    color: 'var(--text-primary, #FFF)',
                    fontFamily: '"Noto Serif KR", serif',
                    fontSize: '14px',
                    fontStyle: 'normal',
                    fontWeight: 500,
                    lineHeight: '160%'
                  }}>
                    {pageInfo.title}
                  </span>
                </div>
              )}
              {/* Selected Text - selectedTextChip이 있을 때만 표시 */}
              {selectedTextChip && (
                <ChipTextContent 
                  selectedTextChip={selectedTextChip}
                  onRemove={() => setSelectedTextChip?.(null)}
                />
              )}
            </div>
          )
        })()}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
          alignSelf: 'stretch',
          borderRadius: '16px',
          border: '1px solid var(--fill-white-10)',
          background: 'var(--GreyScale-700, #222424)',
          padding: '14px',
          position: 'relative',
          zIndex: 10
        }}>
          <div 
            id="chatbot-input-container"
            style={{ 
              width: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'left',
              transition: 'all 0.15s ease',
              backgroundColor: 'transparent'
            }}
          >
            <textarea
              className="scrollbar-transparent-hover"
              ref={inputRef}
              value={chatInput || ''}
              onChange={(e) => {
                if (ignoreNextInputChangeRef.current) {
                  ignoreNextInputChangeRef.current = false
                  setChatInput('')
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto'
                  }
                  return
                }
                setChatInput(e.target.value || '')
                // 자동 높이 조절
                if (inputRef.current) {
                  inputRef.current.style.height = 'auto'
                  inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
                }
              }}
              onKeyDown={(e) => {
                // IME 조합 중 Enter 방지
                if ((e as any).nativeEvent?.isComposing || (e as any).keyCode === 229) {
                  return
                }
                // Enter: 전송 (Shift가 눌리지 않은 경우, AI 응답 중이면 차단)
                if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  const currentValue = inputRef.current?.value ?? chatInput ?? ''
                  if (!isLoading && currentValue.trim()) {
                    // input을 먼저 비우고 메시지 전송
                    const messageToSend = currentValue.trim()
                    ignoreNextInputChangeRef.current = true
                    setChatInput('')
                    handleSend(messageToSend)
                  }
                  return
                }
                // Shift+Enter: 줄바꿈 (기본 동작 허용)
                // Command+Enter 또는 Ctrl+Enter: 전송
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  e.stopPropagation()
                  const currentValue = inputRef.current?.value ?? chatInput ?? ''
                  if (!isLoading && currentValue.trim()) {
                    // input을 먼저 비우고 메시지 전송
                    const messageToSend = currentValue.trim()
                    ignoreNextInputChangeRef.current = true
                    setChatInput('')
                    handleSend(messageToSend)
                  }
                  return
                }
              }}
              placeholder="노영주가 어떤 것을 작업했는지 물어보세요"
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: '"Pretendard Variable", sans-serif',
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: '160%',
                resize: 'none',
                overflow: 'auto',
                minHeight: '20px',
                maxHeight: '200px',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                padding: 0,
                margin: 0
              }}
              rows={1}
            />
          </div>
          <div style={{ 
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            alignSelf: 'stretch'
          }}>
            {/* I ⌘ hint text */}
            <div className='flex gap-3'>
            <div className='flex items-center gap-2'>
            <span style={{
              color: 'var(--text-placeholder, #B3B3B3)',
              fontFamily: 'GalmuriMono9, monospace',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: 'normal'
            }}>
              I
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none">
<g clipPath="url(#clip0_507_292)">
<path d="M7.75 2.5V9.5C7.75 9.84612 7.85263 10.1845 8.04493 10.4722C8.23722 10.76 8.51053 10.9843 8.8303 11.1168C9.15007 11.2492 9.50194 11.2839 9.84141 11.2164C10.1809 11.1488 10.4927 10.9822 10.7374 10.7374C10.9822 10.4927 11.1488 10.1809 11.2164 9.84141C11.2839 9.50194 11.2492 9.15007 11.1168 8.8303C10.9843 8.51053 10.76 8.23722 10.4722 8.04493C10.1845 7.85263 9.84612 7.75 9.5 7.75H2.5C2.15388 7.75 1.81554 7.85263 1.52775 8.04493C1.23997 8.23722 1.01566 8.51053 0.883212 8.8303C0.750758 9.15007 0.716102 9.50194 0.783627 9.84141C0.851151 10.1809 1.01782 10.4927 1.26256 10.7374C1.50731 10.9822 1.81913 11.1488 2.15859 11.2164C2.49806 11.2839 2.84993 11.2492 3.1697 11.1168C3.48947 10.9843 3.76278 10.76 3.95507 10.4722C4.14736 10.1845 4.25 9.84612 4.25 9.5V2.5C4.25 2.15388 4.14736 1.81554 3.95507 1.52775C3.76278 1.23997 3.48947 1.01566 3.1697 0.883212C2.84993 0.750758 2.49806 0.716102 2.15859 0.783627C1.81913 0.851151 1.50731 1.01782 1.26256 1.26256C1.01782 1.50731 0.851151 1.81913 0.783627 2.15859C0.716102 2.49806 0.750758 2.84993 0.883212 3.1697C1.01566 3.48947 1.23997 3.76278 1.52775 3.95507C1.81554 4.14736 2.15388 4.25 2.5 4.25H9.5C9.84612 4.25 10.1845 4.14736 10.4722 3.95507C10.76 3.76278 10.9843 3.48947 11.1168 3.1697C11.2492 2.84993 11.2839 2.49806 11.2164 2.15859C11.1488 1.81913 10.9822 1.50731 10.7374 1.26256C10.4927 1.01782 10.1809 0.851151 9.84141 0.783627C9.50194 0.716102 9.15007 0.750758 8.8303 0.883212C8.51053 1.01566 8.23722 1.23997 8.04493 1.52775C7.85263 1.81554 7.75 2.15388 7.75 2.5Z" stroke="white" strokeOpacity="0.8" strokeLinecap="round" strokeLinejoin="round"/>
</g>
<defs>
<clipPath id="clip0_507_292">
<rect width="12" height="12" fill="white"/>
</clipPath>
</defs>
</svg>
            </div>
            {isLoading ? (
              <button
                onClick={handleStop}
                style={{
                  display: 'flex',
                  padding: '8px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: '16px',
                  background: 'var(--orange-400, #DB6930)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontWeight: 400,
                  lineHeight: 'normal',
                  height: '32px',
                  width: '32px',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                aria-label="Stop"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ width: '14px', height: '14px', flexShrink: 0 }}
                >
                  <rect x="1" y="1" width="14" height="14" rx="4" fill="white" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!chatInput?.trim() || isLoading}
                style={{
                  display: 'flex',
                  padding: '8px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '24px',
                  background: (chatInput?.trim() && !isLoading) ? 'var(--orange-400, #DB6930)' : 'var(--orange-800, #662707)',
                  color: (chatInput?.trim() && !isLoading) ? 'var(--text-primary, #FFF)' : 'var(--text-disabled, #838383)',
                  border: 'none',
                  cursor: (chatInput?.trim() && !isLoading) ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease',
                  fontFamily: 'GalmuriMono9, monospace',
                  fontSize: '13px',
                  fontWeight: 400,
                  lineHeight: 'normal',
                  opacity: (chatInput?.trim() && !isLoading) ? 1 : 0.5,
                  height: '32px',
                  width: '32px',
                }}
                onMouseEnter={(e) => {
                  if (chatInput?.trim() && !isLoading) {
                    e.currentTarget.style.opacity = '0.9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (chatInput?.trim() && !isLoading) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                aria-label="Send"
              >
                <div className="send-icons flex items-center" style={{ width: 'auto', height: '20px', gap: '6px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<g clipPath="url(#clip0_513_2487)">
<path d="M8 15L8 1M8 1L1 8M8 1L15 8" stroke="#838383" strokeLinecap="round" strokeLinejoin="round"/>
</g>
<defs>
<clipPath id="clip0_513_2487">
<rect width="16" height="16" fill="currentColor"/>
</clipPath>
</defs>
</svg>
</div>
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

