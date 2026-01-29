import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')

// Vercel에서 GET+PUT 동시 사용 시 405 방지: 동적 라우트로 처리
export const dynamic = 'force-dynamic'

// 프로젝트 목록 조회
export async function GET() {
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    const projects = JSON.parse(data)
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
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    projects = JSON.parse(data)
  } catch {
    projects = []
  }

  const existingIndex = projects.findIndex((p: any) => p.id === project.id)
  if (existingIndex >= 0) {
    projects[existingIndex] = project
  } else {
    projects.push(project)
  }

  const dir = path.dirname(PROJECTS_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))
  return NextResponse.json({ success: true, project })
}

// 프로젝트 추가/수정 — POST 사용 (Vercel GET+PUT 동시 사용 시 405 회피)
export async function POST(request: NextRequest) {
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

