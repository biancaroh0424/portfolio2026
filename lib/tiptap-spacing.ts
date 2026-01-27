import { Node } from '@tiptap/core'

export const Spacing = Node.create({
  name: 'spacing',
  
  group: 'block',
  
  atom: true,
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="spacing"]',
      },
    ]
  },
  
  renderHTML() {
    return ['div', { 'data-type': 'spacing', class: 'editor-spacing' }]
  },
  
  addCommands() {
    return {
      setSpacing: () => ({ commands }: { commands: { insertContent: (content: string) => boolean } }) => {
        return commands.insertContent('<div data-type="spacing" class="editor-spacing"></div>')
      },
    } as any
  },
})
