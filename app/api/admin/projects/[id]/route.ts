import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')

// 프로젝트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id

    // 기존 프로젝트 로드
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    const projects = JSON.parse(data)

    // 프로젝트 삭제
    const filteredProjects = projects.filter((p: any) => p.id !== projectId)

    // 파일 저장
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(filteredProjects, null, 2))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}

