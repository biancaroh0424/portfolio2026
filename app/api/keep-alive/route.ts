import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * UptimeRobot 등으로 5~10분마다 호출해서 서버리스 인스턴스를 깨워 두는 용도.
 * 아무 로직 없이 200만 반환 — 가벼운 경량 엔드포인트.
 */
export async function GET() {
  return NextResponse.json({ ok: true, t: Date.now() })
}
