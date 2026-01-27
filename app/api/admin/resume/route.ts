import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const RESUME_FILE = path.join(process.cwd(), 'data', 'resume.json')

// Resume 조회
export async function GET() {
  try {
    const data = await fs.readFile(RESUME_FILE, 'utf-8')
    const resume = JSON.parse(data)
    return NextResponse.json(resume)
  } catch (error) {
    // 파일이 없으면 기본값 반환
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ en: '', ko: '', it: '' })
    }
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

    // 파일 저장
    const dir = path.dirname(RESUME_FILE)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(RESUME_FILE, JSON.stringify(resume, null, 2))

    return NextResponse.json({ success: true, resume })
  } catch (error) {
    console.error('Error saving resume:', error)
    return NextResponse.json(
      { error: 'Failed to save resume' },
      { status: 500 }
    )
  }
}

