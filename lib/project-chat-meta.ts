/**
 * 챗봇(/api/chat)에서 /portfolio 리스트용으로 프로젝트 메타(기간·요약)를 뽑을 때 사용.
 * 카드 UI(`app/(protected)/portfolio/page.tsx`)와 동일한 필드 해석.
 */

import type { Project, ProjectField } from '@/lib/data'

export type ProjectListLanguage = 'en' | 'ko' | 'it'

export type ProjectOnPageForChat = {
  id: string
  title: string
  /** CMS duration 필드 (기간 문자열) */
  duration?: string
  /** CMS summary 필드 */
  summary?: string
}

function getProjectTranslation(project: Project, language: ProjectListLanguage) {
  const translations = project.translations
  if (translations?.[language]) {
    const t = translations[language]!
    return {
      title: t.title || '',
      fields: (t.fields || []) as ProjectField[],
    }
  }
  if (
    language === 'en' &&
    (project.title || project.content || (project.fields && project.fields.length > 0))
  ) {
    return {
      title: project.title || '',
      fields: project.fields || [],
    }
  }
  return { title: '', fields: [] as ProjectField[] }
}

export function getProjectOnPageForChat(
  project: Project,
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
    id: project.id,
    title,
    ...(duration ? { duration } : {}),
    ...(summary ? { summary } : {}),
  }
}
