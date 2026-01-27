import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const ANALYTICS_FILE = path.join(process.cwd(), 'data', 'analytics.json')

interface ChatEntry {
  id: string
  timestamp: string
  question: string
  answer: string
  hour: number // 0-23
  date: string // YYYY-MM-DD
  userId?: string // 사용자 ID
  location?: string // 위치 (timezone)
  device?: string // 디바이스 정보
  deviceType?: string // desktop | mobile | tablet
  os?: string // 운영체제
  browser?: string // 브라우저
}

// 질문 데이터 저장
export async function POST(request: NextRequest) {
  try {
    const { question, answer, userId, location, device, deviceType, os, browser } = await request.json()
    
    if (!question || !answer) {
      return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 })
    }

    const now = new Date()
    const entry: ChatEntry = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: now.toISOString(),
      question,
      answer,
      hour: now.getHours(),
      date: now.toISOString().split('T')[0],
      userId: userId || 'unknown',
      location: location || 'unknown',
      device: device || 'unknown',
      deviceType: deviceType || 'unknown',
      os: os || 'unknown',
      browser: browser || 'unknown'
    }

    // analytics.json 파일 읽기
    let entries: ChatEntry[] = []
    try {
      const fileContent = await fs.readFile(ANALYTICS_FILE, 'utf-8')
      entries = JSON.parse(fileContent)
    } catch (error) {
      // 파일이 없으면 새로 생성
      entries = []
    }

    // 새 엔트리 추가
    entries.push(entry)

    // 파일 저장
    await fs.mkdir(path.dirname(ANALYTICS_FILE), { recursive: true })
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(entries, null, 2), 'utf-8')

    return NextResponse.json({ success: true, id: entry.id })
  } catch (error) {
    console.error('Error saving analytics:', error)
    return NextResponse.json({ error: 'Failed to save analytics' }, { status: 500 })
  }
}

// 질문 데이터 조회 (시간별 통계 포함)
export async function GET(request: NextRequest) {
  try {
    // analytics.json 파일 읽기
    let entries: ChatEntry[] = []
    try {
      const fileContent = await fs.readFile(ANALYTICS_FILE, 'utf-8')
      entries = JSON.parse(fileContent)
    } catch (error) {
      // 파일이 없으면 빈 배열 반환
      entries = []
    }

    // 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const hour = searchParams.get('hour')

    // 특정 날짜/시간 필터링
    let filteredEntries = entries
    if (date) {
      filteredEntries = filteredEntries.filter(e => e.date === date)
    }
    if (hour !== null) {
      const hourNum = parseInt(hour || '0')
      filteredEntries = filteredEntries.filter(e => e.hour === hourNum)
    }

    // 시간별 통계 생성 (24시간)
    const hourlyStats = Array.from({ length: 24 }, (_, i) => {
      const count = entries.filter(e => e.hour === i).length
      return { hour: i, count }
    })

    // 날짜별 통계 생성 (최근 30일)
    const dateStats = new Map<string, number>()
    entries.forEach(entry => {
      const count = dateStats.get(entry.date) || 0
      dateStats.set(entry.date, count + 1)
    })

    const dateStatsArray = Array.from(dateStats.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // 최근 30일

    // 사용자별 통계
    const userStats = new Map<string, { count: number; firstSeen: string; lastSeen: string; location?: string; device?: string }>()
    entries.forEach(entry => {
      if (entry.userId) {
        const existing = userStats.get(entry.userId) || { count: 0, firstSeen: entry.timestamp, lastSeen: entry.timestamp, location: entry.location, device: entry.device }
        existing.count++
        if (new Date(entry.timestamp) < new Date(existing.firstSeen)) {
          existing.firstSeen = entry.timestamp
        }
        if (new Date(entry.timestamp) > new Date(existing.lastSeen)) {
          existing.lastSeen = entry.timestamp
        }
        userStats.set(entry.userId, existing)
      }
    })

    // 디바이스별 통계
    const deviceStats = new Map<string, number>()
    entries.forEach(entry => {
      if (entry.deviceType) {
        const count = deviceStats.get(entry.deviceType) || 0
        deviceStats.set(entry.deviceType, count + 1)
      }
    })

    // 위치별 통계
    const locationStats = new Map<string, number>()
    entries.forEach(entry => {
      if (entry.location) {
        const count = locationStats.get(entry.location) || 0
        locationStats.set(entry.location, count + 1)
      }
    })

    return NextResponse.json({
      entries: filteredEntries,
      hourlyStats,
      dateStats: dateStatsArray,
      total: entries.length,
      userStats: Array.from(userStats.entries()).map(([userId, stats]) => ({ userId, ...stats })),
      deviceStats: Array.from(deviceStats.entries()).map(([device, count]) => ({ device, count })),
      locationStats: Array.from(locationStats.entries()).map(([location, count]) => ({ location, count }))
    })
  } catch (error) {
    console.error('Error reading analytics:', error)
    return NextResponse.json({ error: 'Failed to read analytics' }, { status: 500 })
  }
}
