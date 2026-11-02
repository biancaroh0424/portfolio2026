import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { saveProjectMedia } from '@/lib/project-media'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request)
  if (authError) return authError
  try {
    const body = await request.json()
    const url = new URL(body.blobUrl)
    const types = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')
      || !/^\/protected-uploads\/[a-f0-9]+[^/]*\.bin$/.test(url.pathname)
      || !types.includes(body.contentType) || typeof body.filename !== 'string'
      || typeof body.clientKey !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(body.clientKey)
      || typeof body.clientIv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(body.clientIv)) {
      return NextResponse.json({ error: 'Invalid media' }, { status: 400 })
    }
    const mediaUrl = await saveProjectMedia({
      blobUrl: url.toString(), contentType: body.contentType, filename: body.filename,
      clientKey: body.clientKey, clientIv: body.clientIv,
    })
    return NextResponse.json({ url: mediaUrl }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error registering project media:', error)
    return NextResponse.json({ error: 'Failed to register media' }, { status: 400 })
  }
}
