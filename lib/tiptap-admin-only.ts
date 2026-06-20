import { Mark } from '@tiptap/core'

/** Admin 전용 텍스트 마크. 유저에게는 숨기고, 챗봇/RAG 임베딩에는 포함 */
export const AdminOnly = Mark.create({
  name: 'adminOnly',

  parseHTML() {
    return [
      { tag: 'span[data-admin-only]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-admin-only': 'true', class: 'admin-only-mark' }, 0]
  },

  addCommands() {
    return {
      setAdminOnly: () => ({ commands }: { commands: { toggleMark: (name: string) => boolean } }) => {
        return commands.toggleMark('adminOnly')
      },
      unsetAdminOnly: () => ({ commands }: { commands: { unsetMark: (name: string) => boolean } }) => {
        return commands.unsetMark('adminOnly')
      },
    } as any
  },
})
