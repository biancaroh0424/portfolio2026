/**
 * 프로젝트 본문 HTML에서 `data-portfolio-vector-only="1"` 블록을 제거합니다.
 * — 공개 포트폴리오 페이지·목차(헤딩) 추출용. RAG용 원문에는 제거하지 않습니다.
 */
const ATTR_RE = /data-portfolio-vector-only\s*=\s*["']?1["']?/i

function nextDivOpen(html: string, from: number): number {
  const i = html.toLowerCase().indexOf('<div', from)
  return i === -1 ? -1 : i
}

function nextDivClose(html: string, from: number): number {
  const i = html.toLowerCase().indexOf('</div>', from)
  return i === -1 ? -1 : i
}

/** 열린 태그 끝 `>` 위치 (from은 `<div` 시작 인덱스) */
function endOfOpenTag(html: string, from: number): number {
  const gt = html.indexOf('>', from)
  return gt === -1 ? -1 : gt
}

export function stripPortfolioVectorOnlyHtml(html: string): string {
  if (!html || !ATTR_RE.test(html)) return html

  let s = html
  let guard = 0
  while (guard++ < 200) {
    const attrMatch = ATTR_RE.exec(s)
    if (!attrMatch || attrMatch.index === undefined) break

    const idxAttr = attrMatch.index
    const openDiv = s.toLowerCase().lastIndexOf('<div', idxAttr)
    if (openDiv === -1) {
      s = s.slice(0, idxAttr) + s.slice(idxAttr + 1)
      continue
    }

    const openEnd = endOfOpenTag(s, openDiv)
    if (openEnd === -1) break

    const openTagSlice = s.slice(openDiv, openEnd + 1)
    if (!ATTR_RE.test(openTagSlice)) {
      s = s.slice(0, idxAttr) + '\u200b' + s.slice(idxAttr + 1)
      continue
    }

    let depth = 1
    let pos = openEnd + 1
    let removed = false
    while (depth > 0 && pos < s.length) {
      const relOpen = nextDivOpen(s, pos)
      const relClose = nextDivClose(s, pos)
      if (relClose === -1) break
      const openAt = relOpen === -1 ? Infinity : relOpen
      const closeAt = relClose

      if (openAt < closeAt) {
        depth += 1
        pos = relOpen + 4
      } else {
        depth -= 1
        if (depth === 0) {
          const endExclusive = relClose + 6
          s = s.slice(0, openDiv) + s.slice(endExclusive)
          removed = true
          break
        }
        pos = relClose + 6
      }
    }
    if (!removed) break
  }

  return s.replace(/\u200b/g, '')
}
