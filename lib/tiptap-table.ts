import { Node, mergeAttributes } from '@tiptap/core'
import type { Schema } from '@tiptap/pm/model'

type NodeTypeLike = { create: (attrs?: object, content?: unknown) => unknown }
function getNodeType(nodes: Record<string, unknown> | { get(name: string): unknown }, name: string): NodeTypeLike | null {
  const n = (typeof (nodes as { get?: (k: string) => unknown }).get === 'function'
    ? (nodes as { get(k: string): unknown }).get(name)
    : (nodes as Record<string, unknown>)[name]) as NodeTypeLike | undefined
  return n?.create ? n : null
}

/** 스키마로 2x2 테이블 노드 생성 (HTML 파싱 없이 노드 직접 삽입용). th 한 줄 + td 한 줄 이상 보장. */
export function createDefaultTableNode(
  schema: Schema,
  options?: { rows?: number; cols?: number }
): unknown {
  const rows = Math.max(2, options?.rows ?? 2)
  const cols = Math.max(2, options?.cols ?? 2)
  const nodes = schema.nodes as Record<string, unknown> | { get(name: string): unknown }
  const table = getNodeType(nodes, 'table')
  const tableRow = getNodeType(nodes, 'tableRow')
  const tableHeaderCell = getNodeType(nodes, 'tableHeaderCell')
  const tableCell = getNodeType(nodes, 'tableCell')
  const paragraph = getNodeType(nodes, 'paragraph')
  if (!table || !tableRow || !tableHeaderCell || !tableCell || !paragraph) return null
  const headerCells = Array.from({ length: cols }, () =>
    tableHeaderCell.create({}, [paragraph.create({})])
  )
  const headerRow = tableRow.create({}, headerCells)
  // 본문 행은 항상 1개 이상 (th만 있는 표 방지)
  const bodyRowCount = Math.max(1, rows - 1)
  const bodyRows = Array.from({ length: bodyRowCount }, () => {
    const cells = Array.from({ length: cols }, () =>
      tableCell.create({}, [paragraph.create({})])
    )
    return tableRow.create({}, cells)
  })
  return table.create({}, [headerRow, ...bodyRows])
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertTable: (options?: { rows?: number; cols?: number }) => ReturnType
    addTableRowAfter: () => ReturnType
    addTableRowBefore: () => ReturnType
    addTableColumnAfter: () => ReturnType
    addTableColumnBefore: () => ReturnType
  }
}

/** 현재 선택 기준으로 셀의 row/col 인덱스와 테이블 정보 반환 */
function getCellContext($from: { depth: number; node: (d: number) => { type: { name: string }; childCount: number; child: (i: number) => { nodeSize: number }; nodeSize: number }; start: (d: number) => number; pos: number }) {
  let rowIdx = -1
  let colIdx = -1
  let tableDepth = -1
  let tableStart = 0
  let rowNode = null as { childCount: number; child: (i: number) => { nodeSize: number }; nodeSize: number } | null
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'tableRow') {
      rowNode = node
      tableDepth = d - 1
      tableStart = $from.start(tableDepth)
      const rowStart = $from.start(d)
      let pos = rowStart + 1
      for (let c = 0; c < node.childCount; c++) {
        const cell = node.child(c)
        if ($from.pos >= pos && $from.pos < pos + cell.nodeSize) {
          colIdx = c
          break
        }
        pos += cell.nodeSize
      }
      const tableNode = $from.node(tableDepth)
      let run = tableStart + 1
      for (let r = 0; r < tableNode.childCount; r++) {
        const row = tableNode.child(r)
        if (run === rowStart) {
          rowIdx = r
          break
        }
        run += row.nodeSize
      }
      break
    }
  }
  if (!rowNode || tableDepth < 0) return null
  const tableNode = $from.node(tableDepth)
  return {
    rowIdx,
    colIdx,
    tableNode,
    tableStart,
    tableEnd: tableStart + tableNode.nodeSize,
    rowCount: tableNode.childCount,
    colCount: rowNode.childCount,
  }
}

export const Table = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  parseHTML() {
    return [{ tag: 'table' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes, { class: 'editor-table' }), 0]
  },
  addCommands() {
    return {
      insertTable:
        (options?: { rows?: number; cols?: number }) =>
        ({ commands, state }) => {
          const rows = Math.max(2, options?.rows ?? 2)
          const cols = Math.max(2, options?.cols ?? 2)
          const { from } = state.selection
          const { table, tableRow, tableHeaderCell, tableCell } = state.schema.nodes
          const paragraph = state.schema.nodes.paragraph

          const headerCells = Array.from({ length: cols }, () =>
            tableHeaderCell.create({}, [paragraph.create()])
          )
          const headerRow = tableRow.create({}, headerCells)

          // 본문 행 항상 1개 이상 (th만 있는 표 방지)
          const bodyRowCount = Math.max(1, rows - 1)
          const bodyRows = Array.from({ length: bodyRowCount }, () => {
            const cells = Array.from({ length: cols }, () =>
              tableCell.create({}, [paragraph.create()])
            )
            return tableRow.create({}, cells)
          })

          const tableNode = table.create({}, [headerRow, ...bodyRows])
          return commands.insertContentAt(from, tableNode)
        },
      addTableRowAfter:
        () =>
        ({ state, dispatch }) => {
          const ctx = getCellContext(state.selection.$from)
          if (!ctx) return false
          const { tableNode, tableStart, tableEnd, colCount } = ctx
          const { table, tableRow, tableCell, paragraph } = state.schema.nodes
          // 새 행 = 아래쪽이니까 전부 td (th는 맨 위 한 줄만)
          const newCells = Array.from({ length: colCount }, () =>
            tableCell.create({}, [paragraph.create()])
          )
          const newRow = tableRow.create({}, newCells)
          const newRows = []
          for (let r = 0; r < tableNode.childCount; r++) {
            newRows.push(tableNode.child(r))
          }
          newRows.push(newRow)
          const newTable = table.create({}, newRows)
          if (dispatch) dispatch(state.tr.replaceWith(tableStart, tableEnd, newTable))
          return true
        },
      addTableRowBefore:
        () =>
        ({ state, dispatch }) => {
          const ctx = getCellContext(state.selection.$from)
          if (!ctx) return false
          const { tableNode, tableStart, tableEnd, rowIdx, colCount } = ctx
          const { table, tableRow, tableCell, tableHeaderCell, paragraph } = state.schema.nodes
          const firstRow = tableNode.child(0)
          const isHeader = firstRow.child(0).type.name === 'tableHeaderCell'
          const CellType = rowIdx === 0 ? tableHeaderCell : tableCell
          const newCells = Array.from({ length: colCount }, () =>
            CellType.create({}, [paragraph.create()])
          )
          const newRow = tableRow.create({}, newCells)
          const newRows = []
          for (let r = 0; r < rowIdx; r++) newRows.push(tableNode.child(r))
          newRows.push(newRow)
          for (let r = rowIdx; r < tableNode.childCount; r++) newRows.push(tableNode.child(r))
          const newTable = table.create({}, newRows)
          if (dispatch) dispatch(state.tr.replaceWith(tableStart, tableEnd, newTable))
          return true
        },
      addTableColumnAfter:
        () =>
        ({ state, dispatch }) => {
          const ctx = getCellContext(state.selection.$from)
          if (!ctx) return false
          const { tableNode, tableStart, tableEnd } = ctx
          const { table, tableRow, tableCell, tableHeaderCell, paragraph } = state.schema.nodes
          // 새 열 = 위쪽(첫 행)은 th, 아래쪽(나머지)은 td
          const newRows = []
          for (let r = 0; r < tableNode.childCount; r++) {
            const row = tableNode.child(r)
            const CellType = r === 0 ? tableHeaderCell : tableCell
            const newCell = CellType.create({}, [paragraph.create()])
            const cells = []
            for (let c = 0; c < row.childCount; c++) cells.push(row.child(c))
            cells.push(newCell)
            newRows.push(tableRow.create({}, cells))
          }
          const newTable = table.create({}, newRows)
          if (dispatch) dispatch(state.tr.replaceWith(tableStart, tableEnd, newTable))
          return true
        },
      addTableColumnBefore:
        () =>
        ({ state, dispatch }) => {
          const ctx = getCellContext(state.selection.$from)
          if (!ctx) return false
          const { tableNode, tableStart, tableEnd, colIdx } = ctx
          const { table, tableRow, tableCell, tableHeaderCell, paragraph } = state.schema.nodes
          const newRows = []
          for (let r = 0; r < tableNode.childCount; r++) {
            const row = tableNode.child(r)
            const CellType = r === 0 ? tableHeaderCell : tableCell
            const newCell = CellType.create({}, [paragraph.create()])
            const cells = []
            for (let c = 0; c < row.childCount; c++) {
              if (c === colIdx) cells.push(newCell)
              cells.push(row.child(c))
            }
            if (colIdx >= row.childCount) cells.push(newCell)
            newRows.push(tableRow.create({}, cells))
          }
          const newTable = table.create({}, newRows)
          if (dispatch) dispatch(state.tr.replaceWith(tableStart, tableEnd, newTable))
          return true
        },
    }
  },
})

export const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableHeaderCell | tableCell)+',
  parseHTML() {
    return [{ tag: 'tr' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0]
  },
})

export const TableHeaderCell = Node.create({
  name: 'tableHeaderCell',
  content: 'block+',
  defining: true,
  allowGapCursor: true,
  parseHTML() {
    return [{ tag: 'th' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes, { class: 'editor-table-head-cell' }), 0]
  },
})

export const TableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  defining: true,
  allowGapCursor: true,
  parseHTML() {
    return [{ tag: 'td' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes, { class: 'editor-table-body-cell' }), 0]
  },
})
