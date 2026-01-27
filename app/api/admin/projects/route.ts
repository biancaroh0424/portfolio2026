import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')

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

// 프로젝트 추가/수정
export async function PUT(request: NextRequest) {
  try {
    const project = await request.json()

    // 기존 프로젝트 로드
    let projects = []
    try {
      const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
      projects = JSON.parse(data)
    } catch (error) {
      // 파일이 없으면 빈 배열로 시작
      projects = []
    }

    // 프로젝트 찾기 또는 추가
    const existingIndex = projects.findIndex((p: any) => p.id === project.id)
    
    if (existingIndex >= 0) {
      projects[existingIndex] = project
    } else {
      projects.push(project)
    }

    // 파일 저장
    const dir = path.dirname(PROJECTS_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))

    return NextResponse.json({ success: true, project })
  } catch (error) {
    console.error('Error saving project:', error)
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 }
    )
  }
}

