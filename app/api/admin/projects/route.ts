import { isAdminRequest, requireAdmin } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'
import { readStoredProjects, writeStoredProjects } from '@/lib/project-storage'

export const dynamic = 'force-dynamic'

// Public visitors receive only published documents. Admin cookies are checked on the server.
export async function GET(request: NextRequest) {
  try {
    const projects = await readStoredProjects(isAdminRequest(request))
    return NextResponse.json(projects, {
      headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
    })
  } catch (error) {
    console.error('Error reading projects:', error)
    return NextResponse.json({ error: 'Failed to read projects' }, { status: 500 })
  }
}

async function saveProject(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError
  try {
    const input = await request.json()
    if (!input || typeof input !== 'object' || typeof input.id !== 'string' || !/^[a-z0-9-]+$/.test(input.id)) {
      return NextResponse.json({ error: '올바른 프로젝트 ID를 입력해 주세요.' }, { status: 400 })
    }
    if (input.visibility !== undefined && input.visibility !== 'public' && input.visibility !== 'private') {
      return NextResponse.json({ error: '올바른 공개 범위를 선택해 주세요.' }, { status: 400 })
    }
    const projects = await readStoredProjects(true)
    const index = projects.findIndex(project => project.id === input.id)
    const existing = projects[index]
    const project = {
      ...input,
      visibility: input.visibility ?? (existing ? existing.visibility ?? 'public' : 'private'),
      updatedAt: new Date().toISOString(),
    }
    if (index >= 0) projects[index] = project
    else projects.push(project)
    await writeStoredProjects(projects)
    return NextResponse.json({ success: true, project }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error saving project:', error)
    return NextResponse.json({ error: '프로젝트를 저장하지 못했습니다. 저장소 설정을 확인해 주세요.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return saveProject(request)
}

export async function PUT(request: NextRequest) {
  return saveProject(request)
}
