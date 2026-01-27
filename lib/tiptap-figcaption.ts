import { Node } from '@tiptap/core'

export const Figcaption = Node.create({
  name: 'figcaption',
  group: 'block',
  content: 'inline*',
  draggable: false,

  parseHTML() {
    return [
      {
        tag: 'figcaption',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figcaption', HTMLAttributes, 0]
  },
})
