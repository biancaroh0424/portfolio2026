import { Node, mergeAttributes } from '@tiptap/core'

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column+',
  draggable: false,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="columns"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'editor-columns' }), 0]
  },

  addCommands() {
    return {
      setColumns: () => ({ commands, state }) => {
        const { selection } = state
        const { from } = selection
        
        try {
          // 현재 위치에 columns 노드 삽입
          const columnsNode = state.schema.nodes.columns.create({}, [
            state.schema.nodes.column.create({}, [
              state.schema.nodes.paragraph.create()
            ]),
            state.schema.nodes.column.create({}, [
              state.schema.nodes.paragraph.create()
            ])
          ])
          
          return commands.insertContentAt(from, columnsNode)
        } catch (error) {
          console.error('Error creating columns:', error)
          // 폴백: HTML로 삽입
          const columnsHTML = `<div data-type="columns" class="editor-columns"><div data-type="column" class="editor-column"><p></p></div><div data-type="column" class="editor-column"><p></p></div></div>`
          return commands.insertContent(columnsHTML)
        }
      },
    }
  },
})

export const Column = Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',
  defining: true,
  
  // 모든 블록 요소를 허용하도록 설정
  allowGapCursor: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-type="column"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'editor-column' }), 0]
  },
})
