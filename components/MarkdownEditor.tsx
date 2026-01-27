'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '마크다운 형식으로 작성하세요...',
  rows = 12,
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split')

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('edit')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'edit' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            편집
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'preview' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            미리보기
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'split' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            분할
          </button>
        </div>
        <div className="text-xs text-gray-500">
          💡 **굵게**, *기울임*, `코드`, - 리스트
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="flex" style={{ minHeight: `${rows * 1.5}rem` }}>
        {/* Edit Panel */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'}>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-full px-4 py-3 font-mono text-sm resize-none focus:outline-none"
              rows={rows}
            />
          </div>
        )}

        {/* Preview Panel */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-y-auto`}>
            <div className="px-4 py-3 prose prose-sm max-w-none">
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">{placeholder}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

