import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { put, list } from '@vercel/blob'

const ANALYTICS_FILE = path.join(process.cwd(), 'data', 'analytics.json')
const BLOB_ANALYTICS_PATH = 'data/analytics.json'

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

/** Vercel 배포 환경에서만 Blob 사용. 로컬에서는 fs 사용 */
function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

/** Blob에서 analytics.json 읽기 (프로덕션용) */
async function readAnalyticsFromBlob(): Promise<ChatEntry[]> {
  try {
    const { blobs } = await list({ prefix: 'data/', limit: 20 })
    const blob =
      blobs.find((b) => b.pathname === BLOB_ANALYTICS_PATH) ??
      blobs.find((b) => b.pathname === `/${BLOB_ANALYTICS_PATH}`) ??
      blobs.find((b) => b.pathname?.endsWith?.('analytics.json'))
    if (!blob?.url) return []
    const url = blob.url + (blob.url.includes('?') ? '&' : '?') + '_=' + Date.now()
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : []
  } catch {
    return []
  }
}

/** Blob에 analytics 저장 (프로덕션용) */
async function writeAnalyticsToBlob(entries: ChatEntry[]): Promise<void> {
  await put(BLOB_ANALYTICS_PATH, JSON.stringify(entries, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/** 로컬 fs에서 analytics 읽기 */
async function readAnalyticsFromFs(): Promise<ChatEntry[]> {
  try {
    const fileContent = await fs.readFile(ANALYTICS_FILE, 'utf-8')
    const parsed = JSON.parse(fileContent)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 로컬 fs에 analytics 저장 */
async function writeAnalyticsToFs(entries: ChatEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(ANALYTICS_FILE), { recursive: true })
  await fs.writeFile(ANALYTICS_FILE, JSON.stringify(entries, null, 2), 'utf-8')
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

    const entries: ChatEntry[] = isBlobStorageEnabled()
      ? await readAnalyticsFromBlob()
      : await readAnalyticsFromFs()

    entries.push(entry)

    if (isBlobStorageEnabled()) {
      await writeAnalyticsToBlob(entries)
    } else {
      await writeAnalyticsToFs(entries)
    }

    return NextResponse.json({ success: true, id: entry.id })
  } catch (error) {
    console.error('Error saving analytics:', error)
    return NextResponse.json({ error: 'Failed to save analytics' }, { status: 500 })
  }
}

// 질문 데이터 조회 (시간별 통계 포함)
export async function GET(request: NextRequest) {
  try {
    const entries: ChatEntry[] = isBlobStorageEnabled()
      ? await readAnalyticsFromBlob()
      : await readAnalyticsFromFs()

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
