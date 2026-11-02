import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from './admin-session'

export function hasAdminSession(): boolean {
  return verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_PASSWORD || '')
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_PASSWORD || '')
}

export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  // NextURL normalizes loopback IPs to "localhost". Compare against the actual
  // Host header so same-origin requests also work on 127.0.0.1 and LAN hosts.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host') || request.nextUrl.host
  const expectedOrigin = `${request.nextUrl.protocol}//${host}`
  if (!origin || origin !== expectedOrigin) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  }
  return null
}

/** Always check in the handler itself, before reading data or performing mutations. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  const password = process.env.ADMIN_PASSWORD || ''
  if (!password) {
    return NextResponse.json({ error: '관리자 비밀번호가 설정되지 않았습니다.' }, { status: 503 })
  }
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return rejectCrossOrigin(request)
  return null
}
