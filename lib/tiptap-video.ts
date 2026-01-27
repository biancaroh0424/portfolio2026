import { Node, mergeAttributes } from '@tiptap/core'

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: false,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      style: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const element = node as HTMLVideoElement
          const src = element.getAttribute('src')
          if (!src) return false
          return {
            src: src,
            controls: element.hasAttribute('controls'),
            style: element.getAttribute('style'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(HTMLAttributes, { controls: true })
    // style 속성이 있으면 그대로 유지
    if (HTMLAttributes.style) {
      attrs.style = HTMLAttributes.style
    }
    return ['video', attrs]
  },

  addCommands() {
    return {
      setVideo: (options: { src: string; controls?: boolean; style?: string }) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})
