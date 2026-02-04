import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { list } from '@vercel/blob'

const RESUME_FILE = path.join(process.cwd(), 'data', 'resume.json')
const BLOB_RESUME_PATH = 'data/resume.json'

function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

/** Blob에서 resume.json 읽기 (프로덕션용) — 다운로드 시 사용 */
async function readResumeFromBlob(): Promise<Record<string, string> | null> {
  try {
    const { blobs } = await list({ prefix: 'data/', limit: 20 })
    const pathnameOf = (b: { pathname?: string; name?: string }) => (b.pathname ?? b.name ?? '') as string
    const blob =
      blobs.find((b) => pathnameOf(b) === BLOB_RESUME_PATH) ??
      blobs.find((b) => pathnameOf(b) === `/${BLOB_RESUME_PATH}`) ??
      blobs.find((b) => pathnameOf(b).endsWith('resume.json')) ??
      blobs.find((b) => pathnameOf(b).includes('resume.json'))
    if (!blob?.url) return null
    const url = String(blob.url) + (String(blob.url).includes('?') ? '&' : '?') + '_=' + Date.now()
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** 공개: lang에 해당하는 이력서 PDF URL로 리다이렉트 (다운로드 유도). 챗봇에서 "이력서 다운로드" 시 이 API 사용 */
export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')?.toLowerCase() || 'en'
  if (!['en', 'ko', 'it'].includes(lang)) {
    return NextResponse.json({ error: 'Invalid lang' }, { status: 400 })
  }
  try {
    let resume: Record<string, string>
    if (isBlobStorageEnabled()) {
      const fromBlob = await readResumeFromBlob()
      if (!fromBlob) {
        return NextResponse.json({ error: 'Resume not configured' }, { status: 404 })
      }
      resume = fromBlob
    } else {
      const data = await fs.readFile(RESUME_FILE, 'utf-8')
      resume = JSON.parse(data) as Record<string, string>
    }
    const fileUrl = resume[lang]?.trim()
    if (!fileUrl) {
      return NextResponse.json({ error: 'Resume not available for this language' }, { status: 404 })
    }
    const base = request.nextUrl.origin
    const redirectUrl = fileUrl.startsWith('http') ? fileUrl : `${base}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`
    return NextResponse.redirect(redirectUrl, 302)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Resume not configured' }, { status: 404 })
    }
    console.error('Resume download error:', error)
    return NextResponse.json({ error: 'Failed to get resume' }, { status: 500 })
  }
}
