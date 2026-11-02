import { NextRequest, NextResponse } from 'next/server'
import { rejectCrossOrigin } from '@/lib/admin-auth'
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSession, matchesAdminPassword } from '@/lib/admin-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Per-instance throttling. Use Vercel Firewall for a limit shared across instances.
const attempts = new Map<string, { count: number; resetsAt: number }>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export async function POST(request: NextRequest) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    return NextResponse.json({ error: '관리자 비밀번호가 설정되지 않았습니다.' }, { status: 503 })
  }

  const now = Date.now()
  for (const [key, value] of attempts) {
    if (value.resetsAt <= now) attempts.delete(key)
  }
  const client = process.env.VERCEL === '1'
    ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    : 'local'
  const attempt = attempts.get(client) || { count: 0, resetsAt: now + WINDOW_MS }
  if (attempt.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((attempt.resetsAt - now) / 1000)), 'Cache-Control': 'no-store' },
    })
  }
  // Bound memory even if requests arrive with many different IP addresses.
  if (attempts.size >= 10000 && !attempts.has(client)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
  }
  attempt.count += 1
  attempts.set(client, attempt)

  let candidate: unknown
  try {
    candidate = (await request.json()).password
  } catch {
    return NextResponse.json({ error: '올바른 비밀번호를 입력해 주세요.' }, { status: 400 })
  }
  if (typeof candidate !== 'string' || !matchesAdminPassword(candidate, password)) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  attempts.delete(client)
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(password), {
    httpOnly: true,
    secure: process.env.VERCEL === '1' || request.nextUrl.protocol === 'https:',
    sameSite: 'strict',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  })
  return response
}

export async function DELETE(request: NextRequest) {
  const originError = rejectCrossOrigin(request)
  if (originError) return originError
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 })
  return response
}
