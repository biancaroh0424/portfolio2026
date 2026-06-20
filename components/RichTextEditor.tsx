'use client'

import type { Editor } from '@tiptap/core'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { ResizableImage } from '@/lib/tiptap-image-resize'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Placeholder from '@tiptap/extension-placeholder'
import React, { useEffect, useState, useRef } from 'react'
import { Spacing } from '@/lib/tiptap-spacing'
import { Video } from '@/lib/tiptap-video'
import { Figure } from '@/lib/tiptap-figure'
import { Figcaption } from '@/lib/tiptap-figcaption'
import { Columns, Column } from '@/lib/tiptap-columns'
import { Table, TableRow, TableHeaderCell, TableCell, createDefaultTableNode } from '@/lib/tiptap-table'
import { VectorOnly } from '@/lib/tiptap-vector-only'
import { optimizeImageForUpload } from '@/lib/client-image-upload'
import { uploadFileToVercelBlob } from '@/lib/browser-blob-upload'
import { AdminOnly } from '@/lib/tiptap-admin-only'
import { Iframe, parseIframeEmbed } from '@/lib/tiptap-iframe'

const VECTOR_ONLY_PLACEHOLDER =
  '챗봇에만 전달할 내용을 여기에 작성하세요. (포트폴리오 페이지에는 표시되지 않습니다.)'

/** 가능하면 선택 블록을 vectorOnly로 감싸고, 불가하면 새 블록 삽입 */
function insertVectorOnlyBlock(editor: Editor) {
  const wrapped = editor.chain().focus().wrapIn('vectorOnly').run()
  if (wrapped) return
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'vectorOnly',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: VECTOR_ONLY_PLACEHOLDER }],
        },
      ],
    })
    .run()
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSave?: (content: string) => void | Promise<void>
  /** 부모에서 저장 시 에디터 최신 HTML을 읽을 수 있도록 (저장 버튼 클릭 시 ref.current() 호출) */
  getContentRef?: React.MutableRefObject<(() => string) | null>
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '내용을 입력하세요...',
  onSave,
  getContentRef,
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuQuery, setSlashMenuQuery] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [isManualSaving, setIsManualSaving] = useState(false)
  const [showCaptionModal, setShowCaptionModal] = useState(false)
  const [captionInput, setCaptionInput] = useState('')
  const [showIframeModal, setShowIframeModal] = useState(false)
  const [iframeInput, setIframeInput] = useState('')
  const [pendingMediaUrl, setPendingMediaUrl] = useState<string | null>(null)
  const [pendingMediaType, setPendingMediaType] = useState<'image' | 'video' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleManualSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const [tableHoverRect, setTableHoverRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const tableHoverElRef = useRef<HTMLElement | null>(null)

  const slashMenuOptions = [
    {
      id: 'heading2',
      label: 'Heading 2',
      icon: 'H2',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleHeading({ level: 2 }).run()
        }
      },
    },
    {
      id: 'heading3',
      label: 'Heading 3',
      icon: 'H3',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleHeading({ level: 3 }).run()
        }
      },
    },
    {
      id: 'heading4',
      label: 'Heading 4',
      icon: 'H4',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleHeading({ level: 4 }).run()
        }
      },
    },
    {
      id: 'heading5',
      label: 'Heading 5',
      icon: 'H5',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleHeading({ level: 5 }).run()
        }
      },
    },
    {
      id: 'heading6',
      label: 'Heading 6',
      icon: 'H6',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleHeading({ level: 6 }).run()
        }
      },
    },
    {
      id: 'bulletList',
      label: 'Bullet List',
      icon: '•',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleBulletList().run()
        }
      },
    },
    {
      id: 'orderedList',
      label: 'Ordered List',
      icon: '1.',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleOrderedList().run()
        }
      },
    },
    {
      id: 'link',
      label: 'Link',
      icon: '🔗',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).run()
          const url = window.prompt('URL을 입력하세요:')
          if (url) {
            editor.chain().focus().setLink({ href: url }).run()
          }
        }
      },
    },
    {
      id: 'image',
      label: 'Image',
      icon: '🖼️',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).run()
          fileInputRef.current?.click()
        }
      },
    },
    {
      id: 'video',
      label: 'Video',
      icon: '🎥',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).run()
          videoInputRef.current?.click()
        }
      },
    },
    {
      id: 'iframe',
      label: 'Iframe (임베드)',
      icon: '📺',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).run()
          setIframeInput('')
          setShowIframeModal(true)
        }
      },
    },
    {
      id: 'adminOnly',
      label: 'Admin only (관리자만 보기)',
      icon: '🔒',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleMark('adminOnly').run()
        }
      },
    },
    {
      id: 'blockquote',
      label: 'Blockquote',
      icon: '"',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).toggleBlockquote().run()
        }
      },
    },
    {
      id: 'horizontalRule',
      label: 'Horizontal Rule',
      icon: '─',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).setHorizontalRule().run()
        }
      },
    },
    {
      id: 'columns',
      label: '2 Columns',
      icon: '⬌',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          const chain = editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from })
          ;(chain as unknown as { setColumns: () => { run: () => void } }).setColumns().run()
        }
      },
    },
    {
      id: 'table',
      label: 'Table (표)',
      icon: '▦',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor
            .chain()
            .focus()
            .deleteRange({ from: from - slashMenuQuery.length - 1, to: from })
            .command(({ state, dispatch }) => {
              const tableNode = createDefaultTableNode(state.schema, { rows: 2, cols: 2 })
              if (!tableNode) return false
              if (dispatch) dispatch(state.tr.replaceSelectionWith(tableNode as import('@tiptap/pm/model').Node))
              return true
            })
            .run()
        }
      },
    },
    {
      id: 'vectorOnly',
      label: '챗봇·RAG 전용 블록 (사이트 비표시)',
      icon: '🤖',
      /** 슬래시 검색용 (라벨 외 키워드) */
      slashSearch: 'rag chatbot 챗봇 벡터 비공개',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).run()
          insertVectorOnlyBlock(editor)
        }
      },
    },
    {
      id: 'spacing',
      label: 'Spacing',
      icon: '⬍',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).insertContent('<div data-type="spacing" class="editor-spacing"></div>').run()
        }
      },
    },
    {
      id: 'alignLeft',
      label: 'Align Left',
      icon: '←',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).setTextAlign('left').run()
        }
      },
    },
    {
      id: 'alignCenter',
      label: 'Align Center',
      icon: '↔',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).setTextAlign('center').run()
        }
      },
    },
    {
      id: 'alignRight',
      label: 'Align Right',
      icon: '→',
      action: () => {
        if (editor) {
          const { from } = editor.state.selection
          editor.chain().focus().deleteRange({ from: from - slashMenuQuery.length - 1, to: from }).setTextAlign('right').run()
        }
      },
    },
  ]

  const filteredSlashOptions = slashMenuOptions.filter((option) => {
    const q = slashMenuQuery.toLowerCase().trim()
    if (!q) return true
    const extra = 'slashSearch' in option && typeof (option as { slashSearch?: string }).slashSearch === 'string'
      ? (option as { slashSearch: string }).slashSearch
      : ''
    const hay = `${option.label} ${option.id} ${extra}`.toLowerCase()
    return hay.includes(q)
  })

  // 자동저장을 위한 debounced onChange
  const handleAutoSave = React.useCallback((content: string) => {
    // 기존 타이머가 있으면 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 저장 중 표시
    setIsSaving(true)

    // 1초 후에 저장 실행
    saveTimeoutRef.current = setTimeout(() => {
      onChange(content)
      setIsSaving(false)
      saveTimeoutRef.current = null
    }, 1000)
  }, [onChange])


  // 클라이언트에서만 렌더링
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // code-block-lowlight 대신 기본 code block 사용
        heading: {
          HTMLAttributes: {
            class: 'heading-noto-serif',
          },
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Color.configure({ types: [TextStyle.name] }),
      TextStyle,
      Placeholder.configure({
        placeholder,
      }),
      Spacing,
      Video,
      Figure,
      Figcaption,
      Columns,
      Column,
      Table,
      TableRow,
      TableHeaderCell,
      TableCell,
      VectorOnly,
      AdminOnly,
      Iframe,
    ],
    parseOptions: {
      preserveWhitespace: 'full',
    },
    content: value,
    onUpdate: ({ editor }) => {
      try {
        const content = editor.getHTML()
        handleAutoSave(content)
      } catch (error) {
        console.error('Error getting HTML:', error)
      }
    },
    editorProps: {
      transformPastedHTML(html) {
        return html
      },
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[400px] text-white',
      },
      handleKeyDown: (view, event) => {
        if (!editor) return false
        
        // Command+S / Ctrl+S → 즉시 저장 (다이얼로그 없이)
        if ((event.metaKey || event.ctrlKey) && event.key === 's') {
          event.preventDefault()
          handleManualSaveRef.current()
          return true
        }
        
        // 저장 확인 다이얼로그가 열려있을 때 Enter 키 처리
        if (showSaveConfirm && event.key === 'Enter' && !isManualSaving) {
          event.preventDefault()
          handleManualSave()
          return true
        }
        
        // 저장 확인 다이얼로그가 열려있을 때 Escape 키 처리
        if (showSaveConfirm && event.key === 'Escape') {
          event.preventDefault()
          setShowSaveConfirm(false)
          return true
        }
        
        const { state } = view
        const { selection } = state
        const { $from } = selection
        
        const blockStart = $from.start($from.depth)
        const textBefore = state.doc.textBetween(blockStart, $from.pos, ' ')
        const isBlockStart = textBefore.trim() === '' || $from.parentOffset === 0
        
        // Shift+Enter: 줄바꿈 (hard break) - slash menu가 열려있지 않을 때만
        if (event.key === 'Enter' && event.shiftKey && !showSlashMenu) {
          editor.chain().focus().setHardBreak().run()
          return true
        }
        
        if (event.key === '/' && isBlockStart && !showSlashMenu) {
          // '/' 문자가 입력되도록 함
          requestAnimationFrame(() => {
            if (editor && editorRef.current) {
              const { from } = editor.state.selection
              const coords = editor.view.coordsAtPos(from)
              const editorRect = editorRef.current.getBoundingClientRect()
              const menuHeight = 300
              const menuWidth = 280
              const windowHeight = window.innerHeight
              const windowWidth = window.innerWidth
              
              let top = coords.top - editorRect.top + 20
              let left = coords.left - editorRect.left
              
              // 화면 밖으로 나가지 않도록 조정
              const absoluteTop = coords.top + 20
              if (absoluteTop + menuHeight > windowHeight) {
                top = coords.top - editorRect.top - menuHeight - 5
              }
              
              const absoluteLeft = coords.left
              if (absoluteLeft + menuWidth > windowWidth) {
                left = Math.max(0, windowWidth - editorRect.left - menuWidth - 10)
              }
              
              setSlashMenuPosition({ top, left })
              setShowSlashMenu(true)
              setSlashMenuQuery('')
              setSelectedSlashIndex(0)
            }
          })
          return false // '/' 문자가 입력되도록 함
        }
        
        if (showSlashMenu) {
          const options = filteredSlashOptions
          
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedSlashIndex((prev: number) => Math.min(prev + 1, options.length - 1))
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedSlashIndex((prev: number) => Math.max(prev - 1, 0))
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            const option = options[selectedSlashIndex]
            if (option) {
              option.action()
              setShowSlashMenu(false)
              setSlashMenuQuery('')
            }
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setShowSlashMenu(false)
            setSlashMenuQuery('')
            return true
          }
          if (event.key === 'Backspace' && slashMenuQuery === '') {
            event.preventDefault()
            setShowSlashMenu(false)
            return true
          }
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && showSlashMenu) {
      const handleUpdate = () => {
        const { from } = editor.state.selection
        const coords = editor.view.coordsAtPos(from)
        if (editorRef.current) {
          const editorRect = editorRef.current.getBoundingClientRect()
          const menuHeight = 300
          const menuWidth = 280
          const windowHeight = window.innerHeight
          const windowWidth = window.innerWidth
          
          let top = coords.top - editorRect.top + 20
          let left = coords.left - editorRect.left
          
          const absoluteTop = coords.top + 20
          if (absoluteTop + menuHeight > windowHeight) {
            top = coords.top - editorRect.top - menuHeight - 5
          }
          
          const absoluteLeft = coords.left
          if (absoluteLeft + menuWidth > windowWidth) {
            left = Math.max(0, windowWidth - editorRect.left - menuWidth - 10)
          }
          
          setSlashMenuPosition({ top, left })
        }
      }
      editor.on('selectionUpdate', handleUpdate)
      handleUpdate()
      return () => {
        editor.off('selectionUpdate', handleUpdate)
      }
    }
  }, [editor, showSlashMenu])

  // 수동 저장 (Command+S / Ctrl+S 또는 저장 버튼)
  const handleManualSave = React.useCallback(async () => {
    if (!editor || isManualSaving) return
    
    const content = editor.getHTML()
    onChange(content)
    setIsManualSaving(true)
    
    // onSave가 제공되면 호출 (벡터 업데이트 포함)
    // content를 직접 전달하여 최신 내용을 저장
    if (onSave) {
      try {
        await onSave(content)
      } catch (error) {
        console.error('Error saving:', error)
      } finally {
        setIsManualSaving(false)
        setShowSaveConfirm(false)
      }
    } else {
      setIsManualSaving(false)
      setShowSaveConfirm(false)
    }
  }, [editor, onChange, onSave, isManualSaving])

  handleManualSaveRef.current = handleManualSave

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      try {
        editor.commands.setContent(value || '', false)
      } catch (error) {
        console.error('Error setting content:', error)
        // content 파싱 에러 시 빈 content로 초기화
        editor.commands.setContent('', false)
      }
    }
  }, [value, editor])

  useEffect(() => {
    if (!editor || !showSlashMenu) return

    const handleUpdate = () => {
      const { $from } = editor.state.selection
      const blockStart = $from.start($from.depth)
      const textBefore = editor.state.doc.textBetween(blockStart, $from.pos, ' ')
      
      if (textBefore.startsWith('/')) {
        const query = textBefore.slice(1).trim()
        setSlashMenuQuery(query)
        setSelectedSlashIndex(0)
      } else {
        setShowSlashMenu(false)
        setSlashMenuQuery('')
      }
    }

    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, showSlashMenu])

  // 부모에서 저장 버튼 클릭 시 에디터 최신 HTML을 읽을 수 있도록
  useEffect(() => {
    if (!getContentRef) return
    if (editor) {
      getContentRef.current = () => editor.getHTML()
    } else {
      getContentRef.current = null
    }
    return () => {
      getContentRef!.current = null
    }
  }, [editor, getContentRef])

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true)
      const uploadFile = await optimizeImageForUpload(file)
      const formData = new FormData()
      formData.append('image', uploadFile)
      formData.append('type', 'editor')

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await response.json()
      // API는 Blob 전체 URL을 반환. 상대 경로(/uploads/...)면 프로덕션에서 404 나므로 절대 URL만 사용
      const imageUrl =
        typeof data?.url === 'string' && data.url.startsWith('http')
          ? data.url
          : typeof data?.url === 'string' && data.url.startsWith('/')
            ? `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}`
            : data?.url

      // caption 입력 모달 표시
      setPendingMediaUrl(imageUrl || null)
      setPendingMediaType('image')
      setCaptionInput('')
      setShowCaptionModal(true)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleVideoUpload = async (file: File) => {
    try {
      setUploadingVideo(true)
      let data: { url?: string }

      try {
        const blob = await uploadFileToVercelBlob(file)
        data = { url: blob.url }
      } catch (blobErr) {
        console.warn('[video upload] Blob client upload failed, falling back to API:', blobErr)
        const formData = new FormData()
        formData.append('video', file)
        formData.append('type', 'editor')

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to upload video')
        }

        data = await response.json()
      }

      const videoUrl =
        typeof data?.url === 'string' && data.url.startsWith('http')
          ? data.url
          : typeof data?.url === 'string' && data.url.startsWith('/')
            ? `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}`
            : data?.url

      // caption 입력 모달 표시
      setPendingMediaUrl(videoUrl || null)
      setPendingMediaType('video')
      setCaptionInput('')
      setShowCaptionModal(true)
    } catch (error) {
      console.error('Error uploading video:', error)
      alert('동영상 업로드에 실패했습니다.')
    } finally {
      setUploadingVideo(false)
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
    }
  }

  const handleInsertIframe = () => {
    if (!editor || !iframeInput.trim()) return
    const parsed = parseIframeEmbed(iframeInput.trim())
    if (!parsed) {
      alert('올바른 iframe embed 코드 또는 URL을 입력해주세요. (예: https://www.youtube.com/embed/xxx 또는 <iframe ...></iframe>)')
      return
    }
    editor.chain().focus().setIframe({
      src: parsed.src,
      width: parsed.width || '100%',
      height: parsed.height || '400',
      allow: parsed.allow,
      allowfullscreen: parsed.allowfullscreen,
    }).run()
    setShowIframeModal(false)
    setIframeInput('')
  }

  const handleInsertMediaWithCaption = () => {
    if (!editor || !pendingMediaUrl || !pendingMediaType) return

    const caption = captionInput.trim()
    const html = editor.getHTML()
    
    // 기존 미디어에 caption 추가하는 경우 (이미 존재하는 미디어)
    const isExistingMedia = html.includes(pendingMediaUrl)
    
    if (isExistingMedia) {
      // 기존 이미지/비디오에 caption 추가/업데이트
      // HTML을 직접 조작하는 방식이 더 안정적
      if (pendingMediaType === 'image') {
        // 이미지가 이미 figure 안에 있는지 확인
        const figureWithImageRegex = new RegExp(
          `(<figure[^>]*>\\s*<img[^>]+src="${pendingMediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*)(<figcaption>[\\s\\S]*?</figcaption>\\s*)?</figure>`,
          'g'
        )
        const standaloneImageRegex = new RegExp(
          `<img[^>]+src="${pendingMediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`,
          'g'
        )
        
        if (html.match(figureWithImageRegex)) {
          // 이미 figure 안에 있으면 figcaption만 업데이트
          const updatedHtml = html.replace(figureWithImageRegex, (match, imgTag, existingCaption) => {
            if (caption) {
              return `${imgTag}<figcaption>${caption}</figcaption></figure>`
            } else {
              // caption이 없으면 figure 제거하고 이미지만 남기기
              return imgTag.replace(/<figure[^>]*>\s*/, '').replace(/\s*<\/figure>/, '')
            }
          })
          editor.commands.setContent(updatedHtml)
        } else if (html.match(standaloneImageRegex)) {
          // 독립적인 이미지면 figure로 감싸기
          const updatedHtml = html.replace(standaloneImageRegex, (match) => {
            if (caption) {
              return `<figure>${match}<figcaption>${caption}</figcaption></figure>`
            } else {
              return match // caption이 없으면 그대로
            }
          })
          editor.commands.setContent(updatedHtml)
        }
      } else if (pendingMediaType === 'video') {
        // 비디오가 이미 figure 안에 있는지 확인
        const figureWithVideoRegex = new RegExp(
          `(<figure[^>]*>\\s*<video[^>]+src="${pendingMediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></video>\\s*)(<figcaption>[\\s\\S]*?</figcaption>\\s*)?</figure>`,
          'g'
        )
        const standaloneVideoRegex = new RegExp(
          `<video[^>]+src="${pendingMediaUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*></video>`,
          'g'
        )
        
        if (html.match(figureWithVideoRegex)) {
          // 이미 figure 안에 있으면 figcaption만 업데이트
          const updatedHtml = html.replace(figureWithVideoRegex, (match, videoTag, existingCaption) => {
            if (caption) {
              return `${videoTag}<figcaption>${caption}</figcaption></figure>`
            } else {
              // caption이 없으면 figure 제거하고 비디오만 남기기
              return videoTag.replace(/<figure[^>]*>\s*/, '').replace(/\s*<\/figure>/, '')
            }
          })
          editor.commands.setContent(updatedHtml)
        } else if (html.match(standaloneVideoRegex)) {
          // 독립적인 비디오면 figure로 감싸기
          const updatedHtml = html.replace(standaloneVideoRegex, (match) => {
            if (caption) {
              return `<figure>${match}<figcaption>${caption}</figcaption></figure>`
            } else {
              return match // caption이 없으면 그대로
            }
          })
          editor.commands.setContent(updatedHtml)
        }
      }
    } else {
      // 새로운 미디어 삽입
      if (pendingMediaType === 'image') {
        if (caption) {
          // figure/figcaption 구조로 삽입
          editor.chain().focus().insertContent(
            `<figure><img src="${pendingMediaUrl}" style="width: 100%; max-width: 100%; height: auto; margin: 2em 0;"><figcaption>${caption}</figcaption></figure>`
          ).run()
        } else {
          // caption 없으면 일반 이미지로 삽입
          editor.chain().focus().setImage({ src: pendingMediaUrl }).run()
        }
      } else if (pendingMediaType === 'video') {
        if (caption) {
          // figure/figcaption 구조로 삽입 - HTML 문자열 사용
          editor.chain().focus().insertContent(
            `<figure><video src="${pendingMediaUrl}" controls style="width: 100%; max-width: 100%; height: auto; border-radius: 8px; margin: 2em 0;"></video><figcaption>${caption}</figcaption></figure>`
          ).run()
        } else {
          // caption 없으면 HTML로 직접 삽입 (TipTap이 자동으로 파싱)
          editor.chain().focus().insertContent(
            `<video src="${pendingMediaUrl}" controls style="width: 100%; max-width: 100%; height: auto; margin: 2em 0;"></video>`
          ).run()
        }
      }
    }

    // 삽입 직후 부모에 즉시 반영 (저장 버튼 눌렀을 때 최신 미디어 포함되도록)
    onChange(editor.getHTML())
    // 모달 닫기 및 상태 초기화
    setShowCaptionModal(false)
    setCaptionInput('')
    setPendingMediaUrl(null)
    setPendingMediaType(null)
  }

  const handleAddCaptionToExistingMedia = () => {
    if (!editor) return

    const { $anchor } = editor.state.selection
    const node = $anchor.parent
    const html = editor.getHTML()
    
    let mediaType: 'image' | 'video' | null = null
    let mediaSrc = ''
    let existingCaption = ''
    
    // 현재 노드가 이미지인지 확인
    if (node.type.name === 'image') {
      mediaType = 'image'
      mediaSrc = node.attrs.src
      
      // 부모가 figure인지 확인하고 caption 찾기
      if ($anchor.depth > 0) {
        const parentNode = $anchor.node($anchor.depth - 1)
        if (parentNode.type.name === 'figure') {
          const figcaptionMatch = html.match(/<figure[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<figcaption>([\s\S]*?)<\/figcaption>/)
          if (figcaptionMatch && figcaptionMatch[1] === mediaSrc) {
            existingCaption = figcaptionMatch[2].trim()
          }
        }
      }
    } else {
      // HTML에서 현재 위치 근처의 이미지나 비디오 찾기
      const pos = $anchor.pos
      const doc = editor.state.doc
      const textContent = doc.textContent
      
      // HTML에서 이미지나 비디오 찾기
      const imageMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/g)
      const videoMatch = html.match(/<video[^>]+src="([^"]+)"[^>]*>/g)
      
      if (imageMatch && imageMatch.length > 0) {
        // 가장 가까운 이미지 사용
        const lastImage = imageMatch[imageMatch.length - 1]
        const srcMatch = lastImage.match(/src="([^"]+)"/)
        if (srcMatch) {
          mediaType = 'image'
          mediaSrc = srcMatch[1]
        }
      } else if (videoMatch && videoMatch.length > 0) {
        // 가장 가까운 비디오 사용
        const lastVideo = videoMatch[videoMatch.length - 1]
        const srcMatch = lastVideo.match(/src="([^"]+)"/)
        if (srcMatch) {
          mediaType = 'video'
          mediaSrc = srcMatch[1]
        }
      }
      
      // 기존 caption 찾기
      if (mediaSrc) {
        const figureMatch = html.match(new RegExp(`<figure[^>]*>[\\s\\S]*?(?:<img[^>]*src="${mediaSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>|<video[^>]*src="${mediaSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>)[\\s\\S]*?<figcaption>([\\s\\S]*?)<\\/figcaption>`))
        if (figureMatch) {
          existingCaption = figureMatch[1].trim()
        }
      }
    }

    if (mediaType && mediaSrc) {
      setPendingMediaUrl(mediaSrc)
      setPendingMediaType(mediaType)
      setCaptionInput(existingCaption)
      setShowCaptionModal(true)
    }
  }


  if (!isMounted || !editor) {
    return (
      <div className="border border-gray-600 rounded-lg p-4">
        <p className="text-white">에디터를 로딩 중...</p>
      </div>
    )
  }

  const handleEditorMouseMove = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const tableEl = target.closest('.editor-table') as HTMLElement | null
    const buttonsEl = target.closest('[data-table-hover-buttons]')
    if (tableEl) {
      tableHoverElRef.current = tableEl
      const r = tableEl.getBoundingClientRect()
      setTableHoverRect({ top: r.top, left: r.left, width: r.width })
    } else if (!buttonsEl) {
      setTableHoverRect(null)
      tableHoverElRef.current = null
    }
  }
  const handleEditorMouseLeave = () => {
    setTableHoverRect(null)
    tableHoverElRef.current = null
  }

  return (
    <div
      className="border border-gray-600 rounded-lg overflow-hidden relative"
      ref={editorRef}
      onMouseMove={handleEditorMouseMove}
      onMouseLeave={handleEditorMouseLeave}
    >
      {/* Bubble Menu - 텍스트 선택 시 표시 */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ 
            duration: 100,
            placement: 'top',
            appendTo: () => document.body,
          }}
        >
          <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg px-2 py-1 flex items-center gap-1 flex-wrap">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('bold') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Bold"
            >
              <strong>B</strong>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('italic') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Italic"
            >
              <em>I</em>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('strike') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Strikethrough"
            >
              <s>S</s>
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('code') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Code"
            >
              &lt;/&gt;
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('heading', { level: 2 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Heading 2"
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('heading', { level: 3 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Heading 3"
            >
              H3
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('heading', { level: 4 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Heading 4"
            >
              H4
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('heading', { level: 5 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Heading 5"
            >
              H5
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('heading', { level: 6 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Heading 6"
            >
              H6
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('bulletList') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Bullet List"
            >
              •
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('orderedList') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Ordered List"
            >
              1.
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              onClick={() => editor.chain().focus().toggleMark('adminOnly').run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('adminOnly') ? 'bg-amber-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Admin only (관리자만 보기)"
            >
              🔒
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  const url = window.prompt('URL을 입력하세요:')
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run()
                  }
                }
              }}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('link') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Link"
            >
              🔗
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('blockquote') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Blockquote"
            >
              &quot;
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              type="button"
              onClick={() => insertVectorOnlyBlock(editor)}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive('vectorOnly') ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="챗봇·RAG 전용 블록 — 포트폴리오에 안 보임, 벡터·챗봇에만 포함"
            >
              🤖
            </button>
            {(() => {
              const { $anchor } = editor.state.selection
              const node = $anchor.parent
              const isImage = node.type.name === 'image'
              const html = editor.getHTML()
              const isVideo = /<video[^>]*>/.test(html) && $anchor.pos >= 0
              
              if (isImage || isVideo) {
                return (
                  <>
                    <div className="w-px h-4 bg-gray-600 mx-1" />
                    <button
                      onClick={handleAddCaptionToExistingMedia}
                      className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
                      title="Add/Edit Caption"
                    >
                      📝
                    </button>
                  </>
                )
              }
              return null
            })()}
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive({ textAlign: 'left' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Align Left"
            >
              ←
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive({ textAlign: 'center' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Align Center"
            >
              ↔
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`px-2 py-1 rounded text-sm ${
                editor.isActive({ textAlign: 'right' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
              title="Align Right"
            >
              →
            </button>
          </div>
        </BubbleMenu>
      )}

      {/* Slash Menu */}
      {showSlashMenu && (
        <div
          className="absolute z-[100] bg-gray-800 border border-gray-600 rounded-lg shadow-xl px-2 py-1 flex items-center gap-1 flex-wrap"
          style={{
            top: `${Math.max(0, slashMenuPosition.top)}px`,
            left: `${Math.max(0, slashMenuPosition.left)}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredSlashOptions.length > 0 ? (
            filteredSlashOptions.map((option, index) => (
              <button
                key={option.id}
                onClick={() => {
                  option.action()
                  setShowSlashMenu(false)
                  setSlashMenuQuery('')
                }}
                onMouseEnter={() => setSelectedSlashIndex(index)}
                className={`px-2 py-1 rounded text-sm transition-colors ${
                  index === selectedSlashIndex ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
                title={option.label}
              >
                <span className="text-base font-medium">{option.icon}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-400">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}

      {/* Toolbar - 가로 정렬, 아이콘만 */}
      <div className="bg-gray-800 border-b border-gray-600 px-4 py-2 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('bold') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('italic') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('strike') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('code') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Code"
        >
          &lt;/&gt;
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('heading', { level: 2 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('heading', { level: 3 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Heading 3"
        >
          H3
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('heading', { level: 4 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Heading 4"
        >
          H4
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('heading', { level: 5 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Heading 5"
        >
          H5
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('heading', { level: 6 }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Heading 6"
        >
          H6
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('bulletList') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('orderedList') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Ordered List"
        >
          1.
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              const url = window.prompt('URL을 입력하세요:')
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }
          }}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('link') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Link"
        >
          🔗
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
          title="Insert Image"
          disabled={uploadingImage}
        >
          🖼️
        </button>
        <button
          onClick={() => videoInputRef.current?.click()}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
          title="Insert Video"
          disabled={uploadingVideo}
        >
          🎥
        </button>
        <button
          onClick={() => {
            setIframeInput('')
            setShowIframeModal(true)
          }}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
          title="Insert Iframe (YouTube, Figma 등 임베드)"
        >
          📺
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('blockquote') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Blockquote"
        >
          &quot;
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
          title="Horizontal Rule"
        >
          ─
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={() => (editor.chain().focus() as unknown as { setColumns: () => { run: () => void } }).setColumns().run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('columns') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="2 Columns"
        >
          ⬌
        </button>
        <button
          onClick={() => {
            editor.chain().focus().command(({ state, dispatch }) => {
              const tableNode = createDefaultTableNode(state.schema, { rows: 2, cols: 2 })
              if (!tableNode) return false
              if (dispatch) dispatch(state.tr.replaceSelectionWith(tableNode as import('@tiptap/pm/model').Node))
              return true
            }).run()
          }}
          className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${
            editor.isActive('table') ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="표 삽입 (Insert Table)"
        >
          <span aria-hidden>▦</span>
          <span>표</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            try {
              (editor as unknown as { chain: () => { focus: () => { addTableRowAfter: () => { run: () => boolean } } } }).chain().focus().addTableRowAfter().run()
            } catch {
              /* 표 밖이면 무시 */
            }
          }}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
          title="행 추가 (아래)"
        >
          행+
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            try {
              (editor as unknown as { chain: () => { focus: () => { addTableColumnAfter: () => { run: () => boolean } } } }).chain().focus().addTableColumnAfter().run()
            } catch {
              /* 표 밖이면 무시 */
            }
          }}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
          title="열 추가 (오른쪽)"
        >
          열+
        </button>
        <button
          type="button"
          onClick={() => insertVectorOnlyBlock(editor)}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive('vectorOnly') ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="챗봇·RAG 전용 블록 — 사이트 비표시, 벡터·챗봇에만 포함"
        >
          🤖
        </button>
        <button
          onClick={() => {
            // Spacing 삽입: 66px 높이의 여백 추가
            editor.chain().focus().insertContent('<div data-type="spacing" class="editor-spacing"></div>').run()
          }}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
          title="Spacing (66px)"
        >
          ⬍
        </button>
        <div className="w-px h-4 bg-gray-600 mx-1" />
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Align Left"
        >
          ←
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Align Center"
        >
          ↔
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`px-2 py-1 rounded text-sm ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-white text-black' : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Align Right"
        >
          →
        </button>
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
          title="Undo"
        >
          ↶
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
          title="Redo"
        >
          ↷
        </button>
      </div>

      {/* Editor */}
      <div className="relative">
        <EditorContent editor={editor} />
        {(uploadingImage || uploadingVideo || isSaving) && (
          <div className="px-4 py-2 text-sm text-gray-400 border-t border-gray-600 flex items-center gap-2">
            {uploadingImage && <span>이미지 업로드 중...</span>}
            {uploadingVideo && <span>동영상 업로드 중...</span>}
            {isSaving && !uploadingImage && !uploadingVideo && <span>자동 저장 중...</span>}
          </div>
        )}
      </div>

      {/* 테이블 호버 시 행/열 추가 버튼 - 새 테이블 삽입 방지: mousedown 막고, 클릭 전파 차단, 실행 후 오버레이 숨김 */}
      {tableHoverRect && editor && (
        <div
          data-table-hover-buttons
          className="fixed z-[100] flex items-center gap-1 rounded bg-gray-800 border border-gray-600 px-2 py-1 shadow-lg"
          style={{
            top: tableHoverRect.top - 38,
            left: tableHoverRect.left,
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              const el = tableHoverElRef.current
              if (el && editor) {
                const firstCell = el.querySelector('th, td')
                if (firstCell) {
                  try {
                    const pos = (editor as { view: { posAtDOM: (node: Node, offset: number) => number } }).view.posAtDOM(firstCell as Node, 0)
                    ;(editor as unknown as { chain: () => { focus: () => { setTextSelection: (p: number) => { addTableRowAfter: () => { run: () => boolean } } } } })
                      .chain()
                      .focus()
                      .setTextSelection(pos)
                      .addTableRowAfter()
                      .run()
                    setTableHoverRect(null)
                    tableHoverElRef.current = null
                  } catch {
                    /* ignore */
                  }
                }
              }
            }}
            className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
            title="행 추가 (아래)"
          >
            행+
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              const el = tableHoverElRef.current
              if (el && editor) {
                const firstCell = el.querySelector('th, td')
                if (firstCell) {
                  try {
                    const pos = (editor as { view: { posAtDOM: (node: Node, offset: number) => number } }).view.posAtDOM(firstCell as Node, 0)
                    ;(editor as unknown as { chain: () => { focus: () => { setTextSelection: (p: number) => { addTableColumnAfter: () => { run: () => boolean } } } } })
                      .chain()
                      .focus()
                      .setTextSelection(pos)
                      .addTableColumnAfter()
                      .run()
                    setTableHoverRect(null)
                    tableHoverElRef.current = null
                  } catch {
                    /* ignore */
                  }
                }
              }
            }}
            className="px-2 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white"
            title="열 추가 (오른쪽)"
          >
            열+
          </button>
        </div>
      )}

      {/* 저장 확인 다이얼로그 */}
      {showSaveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
            <h3 className="text-lg font-semibold text-white mb-4">
              {isManualSaving ? '저장 중...' : '저장하시겠습니까?'}
            </h3>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => !isManualSaving && setShowSaveConfirm(false)}
                disabled={isManualSaving}
                className="px-4 py-2 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                취소
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!isManualSaving) {
                    handleManualSave()
                  }
                }}
                disabled={isManualSaving}
                className="px-4 py-2 rounded text-sm bg-white hover:bg-gray-100 text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isManualSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                )}
                {isManualSaving ? '저장중' : '저장 (Enter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          if (file) {
            handleImageUpload(file)
          }
        }}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0]
          if (file) {
            handleVideoUpload(file)
          }
        }}
        className="hidden"
      />

      {/* Iframe embed 입력 모달 */}
      {showIframeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-white text-lg font-semibold mb-4">Iframe 임베드</h3>
            <p className="text-sm text-gray-400 mb-3">
              YouTube, Figma, CodePen 등 embed URL 또는 iframe 코드를 붙여넣으세요.
            </p>
            <textarea
              value={iframeInput}
              onChange={(e) => setIframeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleInsertIframe()
                } else if (e.key === 'Escape') {
                  setShowIframeModal(false)
                  setIframeInput('')
                }
              }}
              placeholder={'예: https://www.youtube.com/embed/VIDEO_ID\n또는 <iframe src="..." width="560" height="315" ...></iframe>'}
              rows={5}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 mb-4 font-mono text-sm"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowIframeModal(false)
                  setIframeInput('')
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                취소
              </button>
              <button
                onClick={handleInsertIframe}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded text-sm"
              >
                삽입
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Caption 입력 모달 */}
      {showCaptionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-semibold mb-4">
              {pendingMediaType === 'image' ? '이미지 Caption' : '동영상 Caption'}
            </h3>
            <input
              type="text"
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleInsertMediaWithCaption()
                } else if (e.key === 'Escape') {
                  setShowCaptionModal(false)
                  setCaptionInput('')
                  setPendingMediaUrl(null)
                  setPendingMediaType(null)
                }
              }}
              placeholder="Caption을 입력하세요 (선택사항)"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCaptionModal(false)
                  setCaptionInput('')
                  setPendingMediaUrl(null)
                  setPendingMediaType(null)
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                취소
              </button>
              <button
                onClick={handleInsertMediaWithCaption}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-black rounded text-sm"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
