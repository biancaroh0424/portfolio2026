import { Node, mergeAttributes } from '@tiptap/core'

/** iframe embed 코드에서 src, width, height 등 추출 */
export function parseIframeEmbed(input: string): { src: string; width?: string; height?: string; allow?: string; allowfullscreen?: boolean; [key: string]: string | boolean | undefined } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // URL만 입력한 경우 — YouTube, Vimeo 등은 fullscreen 지원
  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) {
    const isEmbedUrl = /youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|figma\.com|codepen\.io|codesandbox\.io/i.test(trimmed)
    return {
      src: trimmed,
      allowfullscreen: isEmbedUrl,
      allow: isEmbedUrl && /youtube|youtu\.be/i.test(trimmed)
        ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        : undefined,
    }
  }

  // iframe 태그에서 속성 추출
  const iframeMatch = trimmed.match(/<iframe([^>]*)>/i)
  if (!iframeMatch) return null

  const attrs: Record<string, string | boolean | undefined> = {}
  const attrStr = iframeMatch[1]

  const srcMatch = attrStr.match(/\ssrc\s*=\s*["']([^"']+)["']/i)
  if (srcMatch) attrs.src = srcMatch[1]
  else return null

  const widthMatch = attrStr.match(/\swidth\s*=\s*["']?([^"'\s>]+)/i)
  if (widthMatch) attrs.width = widthMatch[1]

  const heightMatch = attrStr.match(/\sheight\s*=\s*["']?([^"'\s>]+)/i)
  if (heightMatch) attrs.height = heightMatch[1]

  const allowMatch = attrStr.match(/\sallow\s*=\s*["']([^"']+)["']/i)
  if (allowMatch) attrs.allow = allowMatch[1]

  if (/\sallowfullscreen/i.test(attrStr)) attrs.allowfullscreen = true
  if (/\sframeborder\s*=\s*["']?0["']?/i.test(attrStr)) attrs.frameborder = '0'

  return attrs as { src: string; width?: string; height?: string; allow?: string; allowfullscreen?: boolean; [key: string]: string | boolean | undefined }
}

export const Iframe = Node.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: '100%' },
      height: { default: '400' },
      allow: { default: null },
      allowfullscreen: { default: false },
      frameborder: { default: '0' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'iframe',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLIFrameElement
          const src = el.getAttribute('src')
          if (!src) return false
          return {
            src,
            width: el.getAttribute('width') || '100%',
            height: el.getAttribute('height') || '400',
            allow: el.getAttribute('allow'),
            allowfullscreen: el.hasAttribute('allowfullscreen'),
            frameborder: el.getAttribute('frameborder') || '0',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs: Record<string, string | number | boolean> = {
      ...mergeAttributes(HTMLAttributes),
      frameborder: HTMLAttributes.frameborder ?? '0',
    }
    if (HTMLAttributes.allowfullscreen) {
      attrs.allowfullscreen = true
    }
    return ['iframe', attrs]
  },

  addCommands() {
    return {
      setIframe:
        (options: { src: string; width?: string; height?: string; allow?: string; allowfullscreen?: boolean }) =>
        ({ commands }: { commands: { insertContent: (content: object) => boolean } }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              width: options.width || '100%',
              height: options.height || '400',
              allow: options.allow,
              allowfullscreen: options.allowfullscreen ?? false,
            },
          })
        },
    } as any
  },
})
