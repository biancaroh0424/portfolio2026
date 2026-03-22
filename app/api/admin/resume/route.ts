import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { put, list, del } from '@vercel/blob'

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

/** Blob에서 resume.json 읽기 (프로덕션용) — data/ 아래 파일이 많으면 limit 20이면 resume.json을 놓칠 수 있어 넉넉히 조회 */
async function readResumeFromBlob(): Promise<{ en: string; ko: string; it: string } | null> {
  try {
    const { blobs } = await list({ prefix: 'data/', limit: 1000 })
    const pathnameOf = (b: { pathname?: string; name?: string }) => (b.pathname ?? b.name ?? '') as string
    const blob =
      blobs.find((b) => pathnameOf(b) === BLOB_RESUME_PATH) ??
      blobs.find((b) => pathnameOf(b) === `/${BLOB_RESUME_PATH}`) ??
      blobs.find((b) => pathnameOf(b).endsWith('resume.json')) ??
      blobs.find((b) => pathnameOf(b).includes('resume.json'))
    if (!blob?.url) return null
    const url = String(blob.url) + (String(blob.url).includes('?') ? '&' : '?') + '_=' + Date.now()
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (res.ok) {
        const json = await res.json()
        return { en: json.en ?? '', ko: json.ko ?? '', it: json.it ?? '' }
      }
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
    }
    return null
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

function isVercelBlobFileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

/** 업로드된 PDF 제거 (Blob 또는 public/uploads) */
async function deleteResumePdfFile(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return

  if (isBlobStorageEnabled() && isVercelBlobFileUrl(trimmed)) {
    try {
      await del(trimmed)
    } catch (e) {
      console.error('[admin/resume] Blob delete failed (continuing to clear JSON):', e)
    }
    return
  }

  if (trimmed.startsWith('/uploads/')) {
    const rel = trimmed.replace(/^\//, '')
    const full = path.join(process.cwd(), 'public', rel)
    const resolved = path.resolve(full)
    const base = path.resolve(path.join(process.cwd(), 'public', 'uploads'))
    if (!resolved.startsWith(base)) {
      console.warn('[admin/resume] Skip local delete: path outside uploads', trimmed)
      return
    }
    try {
      await fs.unlink(resolved)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[admin/resume] Local file delete failed:', e)
      }
    }
  }
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

const RESUME_LANGS = ['en', 'ko', 'it'] as const
type ResumeLang = (typeof RESUME_LANGS)[number]

function isResumeLang(s: string | null): s is ResumeLang {
  return s !== null && (RESUME_LANGS as readonly string[]).includes(s)
}

/** 특정 언어 이력서 PDF 제거 + resume.json 반영 */
export async function DELETE(request: NextRequest) {
  try {
    const lang = new URL(request.url).searchParams.get('lang')
    if (!isResumeLang(lang)) {
      return NextResponse.json({ error: 'Invalid or missing lang (en, ko, it)' }, { status: 400 })
    }

    let current: { en: string; ko: string; it: string }
    if (isBlobStorageEnabled()) {
      const fromBlob = await readResumeFromBlob()
      // null이면 빈 객체로 쓰면 다른 언어 URL까지 전부 지워짐 → 절대 덮어쓰지 않음
      if (!fromBlob) {
        console.error('[admin/resume] DELETE: readResumeFromBlob returned null')
        return NextResponse.json(
          {
            error:
              '이력서 설정을 불러오지 못했습니다. data/ Blob 목록 또는 네트워크 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.',
          },
          { status: 503 }
        )
      }
      current = fromBlob
    } else {
      current = await readResumeFromFs()
    }

    const oldUrl = (current[lang] ?? '').trim()
    // 같은 PDF URL을 두 언어가 공유하면: 한쪽만 지울 때 파일을 지우면 다른 언어도 깨짐 → 다른 언어가 같은 URL을 쓰는 동안은 스토리지 삭제 생략
    if (oldUrl) {
      const otherLangs = RESUME_LANGS.filter((l) => l !== lang)
      const stillReferenced = otherLangs.some((l) => (current[l] ?? '').trim() === oldUrl)
      if (!stillReferenced) {
        await deleteResumePdfFile(oldUrl)
      }
    }

    const normalized: { en: string; ko: string; it: string } = {
      en: current.en ?? '',
      ko: current.ko ?? '',
      it: current.it ?? '',
      [lang]: '',
    }

    if (isBlobStorageEnabled()) {
      await writeResumeToBlob(normalized)
    } else {
      const dir = path.dirname(RESUME_FILE)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(RESUME_FILE, JSON.stringify(normalized, null, 2))
    }

    return NextResponse.json({ success: true, resume: normalized })
  } catch (error) {
    console.error('Error deleting resume entry:', error)
    return NextResponse.json({ error: 'Failed to delete resume file' }, { status: 500 })
  }
}
