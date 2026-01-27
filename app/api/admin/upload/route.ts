import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomBytes } from 'crypto'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const videoFile = formData.get('video') as File | null
    const pdfFile = formData.get('pdf') as File | null
    const file = imageFile || videoFile || pdfFile

    if (!file) {
      console.error('No file provided. FormData keys:', Array.from(formData.keys()))
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // 파일 확장자 확인
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    const allowedPdfTypes = ['application/pdf']
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes, ...allowedPdfTypes]
    
    console.log('File type:', file.type, 'File size:', file.size, 'File name:', file.name)
    
    if (!allowedTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type)
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only images, videos, and PDFs are allowed.` },
        { status: 400 }
      )
    }

    // 파일 크기 제한 (이미지: 10MB, 동영상: 100MB, PDF: 10MB)
    const maxSize = allowedVideoTypes.includes(file.type) ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024)
      return NextResponse.json(
        { error: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds ${maxSizeMB}MB limit` },
        { status: 400 }
      )
    }

    // 파일명 생성
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const extension = path.extname(file.name)
    const filename = `${randomBytes(16).toString('hex')}${extension}`

    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })

    // 파일 저장
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buffer)

    // URL 반환
    const url = `/uploads/${filename}`

    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

