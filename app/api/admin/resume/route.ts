import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { put, list } from '@vercel/blob'

const RESUME_FILE = path.join(process.cwd(), 'data', 'resume.json')
const BLOB_RESUME_PATH = 'data/resume.json'

/** Vercel 배포 환경에서만 Blob 사용. 로컬에서는 fs 사용 */
function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

/** Blob에서 resume.json 읽기 (프로덕션용) */
async function readResumeFromBlob(): Promise<{ en: string; ko: string; it: string } | null> {
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
    const json = await res.json()
    return { en: json.en ?? '', ko: json.ko ?? '', it: json.it ?? '' }
  } catch {
    return null
  }
}

/** Blob에 resume 저장 (프로덕션용) */
async function writeResumeToBlob(resume: { en: string; ko: string; it: string }): Promise<void> {
  await put(BLOB_RESUME_PATH, JSON.stringify(resume, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

/** 로컬 fs에서 resume 읽기 */
async function readResumeFromFs(): Promise<{ en: string; ko: string; it: string }> {
  try {
    const data = await fs.readFile(RESUME_FILE, 'utf-8')
    const resume = JSON.parse(data)
    return { en: resume.en ?? '', ko: resume.ko ?? '', it: resume.it ?? '' }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { en: '', ko: '', it: '' }
    }
    throw err
  }
}

// Vercel에서 GET+PUT 동시 사용 시 405 방지
export const dynamic = 'force-dynamic'

// Resume 조회
export async function GET() {
  try {
    if (isBlobStorageEnabled()) {
      const fromBlob = await readResumeFromBlob()
      return NextResponse.json(fromBlob ?? { en: '', ko: '', it: '' })
    }
    const resume = await readResumeFromFs()
    return NextResponse.json(resume)
  } catch (error) {
    console.error('Error loading resume:', error)
    return NextResponse.json(
      { error: 'Failed to load resume' },
      { status: 500 }
    )
  }
}

// Resume 저장
export async function PUT(request: NextRequest) {
  try {
    const resume = await request.json()
    const normalized = { en: resume.en ?? '', ko: resume.ko ?? '', it: resume.it ?? '' }

    if (isBlobStorageEnabled()) {
      await writeResumeToBlob(normalized)
      return NextResponse.json({ success: true, resume: normalized })
    }

    const dir = path.dirname(RESUME_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(RESUME_FILE, JSON.stringify(normalized, null, 2))
    return NextResponse.json({ success: true, resume: normalized })
  } catch (error) {
    console.error('Error saving resume:', error)
    return NextResponse.json(
      { error: 'Failed to save resume' },
      { status: 500 }
    )
  }
}
