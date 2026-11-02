import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const ADMIN_SESSION_COOKIE = 'portfolio_admin_session'
export const ADMIN_SESSION_MAX_AGE = 8 * 60 * 60

/** Preserve the original admin password when no server override is configured. */
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin2026'
}

export function matchesAdminPassword(candidate: string, password: string): boolean {
  if (!password || candidate.length > 1024) return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(candidate), digest(password))
}

function sign(payload: string, password: string): string {
  return createHmac('sha256', password).update(`admin-session-v1:${payload}`).digest('hex')
}

export function createAdminSession(password: string, now = Date.now()): string {
  if (!password) throw new Error('ADMIN_PASSWORD is not configured')
  const expires = Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE
  const payload = `${expires}.${randomBytes(32).toString('hex')}`
  return `${payload}.${sign(payload, password)}`
}

export function verifyAdminSession(token: string | undefined, password: string, now = Date.now()): boolean {
  if (!password || !token || token.length > 256) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expires, nonce, signature] = parts
  if (!/^\d{10}$/.test(expires) || !/^[a-f0-9]{64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return false
  const remaining = Number(expires) - Math.floor(now / 1000)
  if (remaining <= 0 || remaining > ADMIN_SESSION_MAX_AGE) return false
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(`${expires}.${nonce}`, password), 'hex'))
}
