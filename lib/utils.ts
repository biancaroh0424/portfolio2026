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

