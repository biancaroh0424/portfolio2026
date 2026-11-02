import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/admin-auth'
import { readStoredProjects } from '@/lib/project-storage'
import { loadProjectMedia } from '@/lib/project-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[a-f0-9]{32}$/.test(params.id)) return new NextResponse(null, { status: 404 })
  try {
    if (!isAdminRequest(request)) {
      // A media file becomes public only after a public document references it.
      const projects = await readStoredProjects()
      const mediaUrl = `/api/admin/media/${params.id}`
      if (!projects.some(project => JSON.stringify(project).includes(mediaUrl))) {
        return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
      }
    }
    const { media, bytes } = await loadProjectMedia(params.id)
    const headers: Record<string, string> = {
      'Content-Type': media.contentType,
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    }
    let start = 0
    let end = bytes.length - 1
    const range = request.headers.get('range')
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match || (!match[1] && !match[2])) return new NextResponse(null, { status: 416 })
      start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]))
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end
      if (start > end || start >= bytes.length) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } })
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`
    }
    headers['Content-Length'] = String(end - start + 1)
    // Streaming avoids the function response-size limit for large videos.
    let offset = start
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset > end) { controller.close(); return }
        const next = Math.min(offset + 256 * 1024, end + 1)
        controller.enqueue(new Uint8Array(bytes.subarray(offset, next)))
        offset = next
      },
    })
    return new NextResponse(stream, { status: range ? 206 : 200, headers })
  } catch (error) {
    console.error('Error loading project media:', error)
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
