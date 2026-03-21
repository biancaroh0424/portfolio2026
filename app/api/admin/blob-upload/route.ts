import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const runtime = 'nodejs'

/**
 * Vercel Blob 클라이언트 업로드용 토큰 발급.
 * 큰 동영상은 브라우저 → Blob으로 직접 올라가므로 Next API 본문 제한(413)을 피함.
 */
export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Blob storage not configured' }, { status: 503 })
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/quicktime',
            'application/pdf',
          ],
          maximumSizeInBytes: 100 * 1024 * 1024,
        }
      },
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[blob-upload]', e)
    return NextResponse.json({ error: 'Blob token generation failed' }, { status: 500 })
  }
}
