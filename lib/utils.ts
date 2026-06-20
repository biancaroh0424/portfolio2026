/** Admin 전용 텍스트 제거. 유저용 렌더 시 사용. RAG/임베딩에는 원본(전체) 사용 */
export function stripAdminOnlyFromHtml(html: string): string {
  if (!html || typeof html !== 'string') return html
  let result = html.replace(/<span[^>]*data-admin-only[^>]*>[\s\S]*?<\/span>/gi, '')
  // 빈 <p></p> 태그 제거 (공백·&nbsp;·<br>만 있는 경우 포함)
  result = result.replace(/<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
  return result
}

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

