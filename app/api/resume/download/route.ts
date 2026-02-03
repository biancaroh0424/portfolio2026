import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const RESUME_FILE = path.join(process.cwd(), 'data', 'resume.json')

/** 공개: lang에 해당하는 이력서 PDF URL로 리다이렉트 (다운로드 유도) */
export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang')?.toLowerCase() || 'en'
  if (!['en', 'ko', 'it'].includes(lang)) {
    return NextResponse.json({ error: 'Invalid lang' }, { status: 400 })
  }
  try {
    const data = await fs.readFile(RESUME_FILE, 'utf-8')
    const resume = JSON.parse(data) as Record<string, string>
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
