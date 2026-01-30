import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { put, list } from '@vercel/blob'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')
const BLOB_PROJECTS_PATH = 'data/projects.json'

/** Vercel 배포 환경에서만 Blob 사용. 로컬(localhost)에서는 fs 사용 → 토큰 없이 저장 가능 */
function isBlobStorageEnabled(): boolean {
  const onVercel = process.env.VERCEL === '1'
  const hasToken =
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  return onVercel && hasToken
}

/** Vercel Blob에서 projects.json 내용 읽기 (없으면 null) */
async function readProjectsFromBlob(): Promise<any[] | null> {
  try {
    const { blobs } = await list({ prefix: 'data/', limit: 10 })
    const blob = blobs.find((b) => b.pathname === BLOB_PROJECTS_PATH)
    if (!blob?.url) return null
    const url = blob.url + (blob.url.includes('?') ? '&' : '?') + '_=' + Date.now()
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch {
    return null
  }
}

/** 로컬 fs에서 projects 읽기 */
async function readProjectsFromFs(): Promise<any[]> {
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Blob에 projects 저장 (Vercel 프로덕션용) */
async function writeProjectsToBlob(projects: any[]): Promise<void> {
  const body = JSON.stringify(projects, null, 2)
  await put(BLOB_PROJECTS_PATH, body, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

// Vercel에서 GET+PUT 동시 사용 시 405 방지: 동적 라우트로 처리
export const dynamic = 'force-dynamic'

// 프로젝트 목록 조회
export async function GET() {
  try {
    let projects: any[] = []
    if (isBlobStorageEnabled()) {
      const fromBlob = await readProjectsFromBlob()
      if (fromBlob !== null) projects = fromBlob
      else projects = await readProjectsFromFs()
    } else {
      projects = await readProjectsFromFs()
    }
    return NextResponse.json(projects, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error reading projects:', error)
    return NextResponse.json(
      { error: 'Failed to read projects' },
      { status: 500 }
    )
  }
}

async function saveProject(request: NextRequest) {
  const project = await request.json()

  let projects: any[] = []
  if (isBlobStorageEnabled()) {
    const fromBlob = await readProjectsFromBlob()
    if (fromBlob !== null) projects = fromBlob
    else projects = await readProjectsFromFs()
  } else {
    try {
      const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
      projects = JSON.parse(data)
    } catch {
      projects = []
    }
  }

  const existingIndex = projects.findIndex((p: any) => p.id === project.id)
  if (existingIndex >= 0) {
    projects[existingIndex] = project
  } else {
    projects.push(project)
  }

  if (isBlobStorageEnabled()) {
    await writeProjectsToBlob(projects)
  } else {
    const dir = path.dirname(PROJECTS_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))
  }
  return NextResponse.json({ success: true, project })
}

// 프로젝트 추가/수정 — POST 사용 (Vercel GET+PUT 동시 사용 시 405 회피)
export async function POST(request: NextRequest) {
  try {
    return await saveProject(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const detail = error instanceof Error ? error.stack : String(error)
    console.error('Error saving project:', detail)
    return NextResponse.json(
      {
        error: 'Failed to save project',
        message,
        ...(process.env.NODE_ENV === 'development' && { detail }),
      },
      { status: 500 }
    )
  }
}

// PUT도 동일 처리 (호환용)
export async function PUT(request: NextRequest) {
  try {
    return await saveProject(request)
  } catch (error) {
    console.error('Error saving project:', error)
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 }
    )
  }
}

