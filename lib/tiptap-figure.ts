import { Node } from '@tiptap/core'

export const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'block+',
  draggable: false,

  parseHTML() {
    return [
      {
        tag: 'figure',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', HTMLAttributes, 0]
  },
})
