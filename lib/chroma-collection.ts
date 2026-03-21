/**
 * Chroma 컬렉션 이름 — dev / Vercel Preview / Production이 서로 덮어쓰지 않도록 분리.
 *
 * 우선순위:
 * 1. CHROMA_COLLECTION (명시적 설정 — 스테이징·브랜치별 분리에 권장)
 * 2. Vercel Preview → portfolio_content_preview
 * 3. 로컬 next dev (VERCEL 아님) → portfolio_content_local
 * 4. 그 외(프로덕션 등) → portfolio_content
 */
export function getChromaCollectionName(): string {
  const explicit = process.env.CHROMA_COLLECTION?.trim()
  if (explicit) return explicit

  if (process.env.VERCEL_ENV === 'preview') {
    return 'portfolio_content_preview'
  }

  const onVercel = process.env.VERCEL === '1'
  const isLocalDev = process.env.NODE_ENV === 'development' && !onVercel
  if (isLocalDev) {
    return 'portfolio_content_local'
  }

  return 'portfolio_content'
}
