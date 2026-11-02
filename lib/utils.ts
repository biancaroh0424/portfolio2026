// 프로젝트 제목 처리 함수: "RAG Chat Builder Re-design - Internal Data" -> "Internal Data"
export function formatProjectTitle(title: string): string {
  if (title.includes(' - ')) {
    const parts = title.split(' - ')
    if (parts.length > 1 && parts[0].includes('RAG Chat Builder')) {
      return parts.slice(1).join(' - ')
    }
  }
  return title
}

/** Empty translations must not hide a title written in another language. */
export function getAdminProjectTitle(project: {
  id?: string
  title?: string
  translations?: Partial<Record<'en' | 'ko' | 'it', { title?: string }>>
}): string {
  const candidates = [
    project.translations?.en?.title,
    project.translations?.ko?.title,
    project.translations?.it?.title,
    project.title,
    project.id,
  ]
  for (const title of candidates) {
    if (typeof title === 'string' && title.trim()) return title.trim()
  }
  return '프로젝트'
}

