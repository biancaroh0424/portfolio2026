/**
 * 챗봇(/api/chat)에서 /portfolio 리스트용으로 프로젝트 메타(기간·요약)를 뽑을 때 사용.
 * 카드 UI(`app/(protected)/portfolio/page.tsx`)와 동일한 필드 해석.
 */

import type { Project, ProjectField } from '@/lib/data'

export type ProjectListLanguage = 'en' | 'ko' | 'it'

export type ProjectOnPageForChat = {
  id: string
  title: string
  /** 배너 부제목 (카드·상세와 동일: bannerSubtitle 또는 en 레거시 subtitle) */
  subtitle?: string
  /** CMS duration 필드 (기간 문자열) */
  duration?: string
  /** CMS summary 필드 */
  summary?: string
}

/** 챗봇 답변에서 프로젝트를 부를 때: 부제목이 있으면 `제목 (부제목)` */
export function formatProjectTitleForSpeech(title: string, subtitle?: string): string {
  const t = title.trim()
  const s = subtitle?.trim()
  if (!t) return s || ''
  if (!s) return t
  return `${t} (${s})`
}

function getProjectTranslation(project: Project, language: ProjectListLanguage) {
  const translations = project.translations
  if (translations?.[language]) {
    const t = translations[language]!
    return {
      title: t.title || '',
      bannerSubtitle:
        t.bannerSubtitle ||
        (language === 'en' && project.subtitle ? project.subtitle : undefined),
      fields: (t.fields || []) as ProjectField[],
    }
  }
  if (
    language === 'en' &&
    (project.title || project.content || (project.fields && project.fields.length > 0))
  ) {
    return {
      title: project.title || '',
      bannerSubtitle: project.subtitle,
      fields: project.fields || [],
    }
  }
  return { title: '', bannerSubtitle: undefined, fields: [] as ProjectField[] }
}

export function getProjectOnPageForChat(
  project: Project,
  language: ProjectListLanguage
): ProjectOnPageForChat | null {
  const { title, bannerSubtitle, fields } = getProjectTranslation(project, language)
  if (!title.trim()) return null

  const subtitle = bannerSubtitle?.trim() || undefined

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
    ...(subtitle ? { subtitle } : {}),
    ...(duration ? { duration } : {}),
    ...(summary ? { summary } : {}),
  }
}
