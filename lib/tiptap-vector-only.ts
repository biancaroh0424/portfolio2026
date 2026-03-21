import { Node, mergeAttributes } from '@tiptap/core'

/**
 * 챗봇(RAG) 임베딩에만 포함되고, 공개 포트폴리오 본문에서는 제거되는 블록.
 * HTML: <div data-portfolio-vector-only="1" class="portfolio-vector-only-block">...</div>
 */
export const VectorOnly = Node.create({
  name: 'vectorOnly',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-portfolio-vector-only]',
        getAttrs: (el) => {
          const node = el as HTMLElement
          const v = node.getAttribute('data-portfolio-vector-only')
          if (v !== '1') return false
          return {}
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-portfolio-vector-only': '1',
        class: 'portfolio-vector-only-block',
      }),
      0,
    ]
  },
})
