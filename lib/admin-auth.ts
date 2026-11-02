import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE, getAdminPassword, verifyAdminSession } from './admin-session'

export function hasAdminSession(): boolean {
  return verifyAdminSession(cookies().get(ADMIN_SESSION_COOKIE)?.value, getAdminPassword())
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, getAdminPassword())
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
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: '관리자 로그인이 필요합니다.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return rejectCrossOrigin(request)
  return null
}
