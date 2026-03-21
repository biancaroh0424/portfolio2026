/**
 * 챗봇(/api/chat)에서 /portfolio 리스트용으로 프로젝트 메타(기간·요약)를 뽑을 때 사용.
 * 카드 UI(`app/(protected)/portfolio/page.tsx`)와 동일한 필드 해석.
 */

export type ProjectListLanguage = 'en' | 'ko' | 'it'

export type ProjectOnPageForChat = {
  id: string
  title: string
  /** CMS duration 필드 (기간 문자열) */
  duration?: string
  /** CMS summary 필드 */
  summary?: string
}

type Field = { label?: string; value?: string; type?: string }

function getProjectTranslation(project: Record<string, unknown>, language: ProjectListLanguage) {
  const translations = project.translations as Record<string, { title?: string; fields?: Field[] }> | undefined
  if (translations?.[language]) {
    const t = translations[language]
    return {
      title: t.title || '',
      fields: t.fields || [],
    }
  }
  if (
    language === 'en' &&
    (project.title || project.content || (project.fields as Field[] | undefined)?.length)
  ) {
    return {
      title: (project.title as string) || '',
      fields: (project.fields as Field[]) || [],
    }
  }
  return { title: '', fields: [] as Field[] }
}

export function getProjectOnPageForChat(
  project: Record<string, unknown>,
  language: ProjectListLanguage
): ProjectOnPageForChat | null {
  const { title, fields } = getProjectTranslation(project, language)
  if (!title.trim()) return null

  const durationField = fields.find(
    (f) =>
      f.type === 'duration' ||
      (f.type === 'default' && f.label?.toLowerCase().includes('duration'))
  )
  const duration = durationField?.value?.trim() || ''

  const summaryField = fields.find((f) => f.type === 'summary')
  const summary = summaryField?.value?.trim() || ''

  return {
    id: String(project.id ?? ''),
    title,
    ...(duration ? { duration } : {}),
    ...(summary ? { summary } : {}),
  }
}
