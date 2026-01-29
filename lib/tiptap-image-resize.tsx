import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useState, useEffect, useRef } from 'react'

const ResizableImageComponent = ({ node, updateAttributes, selected, getPos, editor }: any) => {
  const [width, setWidth] = useState(node.attrs.width || null)
  const [height, setHeight] = useState(node.attrs.height || null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [isSelected, setIsSelected] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  // 에디터의 선택 상태 확인
  useEffect(() => {
    if (!editor) {
      // editor가 없으면 항상 선택된 것으로 표시 (임시)
      setIsSelected(true)
      return
    }
    
    const updateSelection = () => {
      const { selection } = editor.state
      const pos = typeof getPos === 'function' ? getPos() : null
      
      if (pos !== null && pos !== undefined) {
        // NodeSelection인지 확인
        const isNodeSelection = selection.constructor.name === 'NodeSelection' || 
                               (selection as any).node !== undefined
        const isNodeSelected = 
          (isNodeSelection && (selection as any).anchor === pos) || 
          (selection.from <= pos && selection.to >= pos + node.nodeSize)
        setIsSelected(isNodeSelected || selected === true)
      } else {
        setIsSelected(selected === true || true) // 임시로 항상 true
      }
    }
    
    updateSelection()
    
    const handleSelectionUpdate = () => updateSelection()
    const handleTransaction = () => updateSelection()
    
    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('transaction', handleTransaction)
    
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('transaction', handleTransaction)
    }
  }, [editor, getPos, selected, node.nodeSize])
  
  // 이미지 클릭 시 선택
  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (editor && typeof getPos === 'function') {
      const pos = getPos()
      if (pos !== null && pos !== undefined) {
        try {
          editor.commands.setNodeSelection(pos)
          setIsSelected(true)
        } catch (error) {
          console.error('Error setting node selection:', error)
          setIsSelected(true) // 에러가 나도 선택된 것으로 표시
        }
      } else {
        setIsSelected(true)
      }
    } else {
      setIsSelected(true)
    }
  }

  // 이미지 더블클릭 시 교체
  const handleImageDoubleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!editor || typeof getPos !== 'function') return

    // 파일 입력 요소 생성
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return

      try {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('type', 'editor')

        const response = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to upload image')
        }

        const data = await response.json()
        const raw = data?.url
        const newImageUrl =
          typeof raw === 'string' && raw.startsWith('http')
            ? raw
            : typeof raw === 'string' && raw.startsWith('/')
              ? `${typeof window !== 'undefined' ? window.location.origin : ''}${raw}`
              : raw

        // 이미지 src 업데이트
        const pos = getPos()
        if (pos !== null && pos !== undefined && updateAttributes) {
          updateAttributes({ src: newImageUrl })
        }
      } catch (error) {
        console.error('Error replacing image:', error)
        alert('이미지 교체에 실패했습니다.')
      }
    }

    input.click()
  }

  useEffect(() => {
    // 노드 attrs가 업데이트되면 state도 업데이트 (리사이징 중이 아닐 때만)
    // 리사이징 중에는 노드 attrs 변경을 무시하여 state가 덮어쓰이지 않도록 함
    if (!isResizing) {
      const newWidth = node.attrs.width || null
      const newHeight = node.attrs.height || null
      
      // 값이 실제로 변경되었을 때만 업데이트
      if (newWidth !== width || newHeight !== height) {
        setWidth(newWidth)
        setHeight(newHeight)
      }
    }
  }, [node.attrs.width, node.attrs.height, isResizing, width, height])
  
  // 이미지 로드 후 초기 크기 설정
  useEffect(() => {
    if (imgRef.current && !width && !height) {
      imgRef.current.onload = () => {
        if (imgRef.current) {
          const naturalWidth = imgRef.current.naturalWidth
          const naturalHeight = imgRef.current.naturalHeight
          if (naturalWidth && naturalHeight) {
            setWidth(naturalWidth)
            setHeight(naturalHeight)
          }
        }
      }
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    
    if (!imgRef.current) {
      console.error('Image ref is null')
      return
    }
    
    setIsResizing(true)
    setResizeHandle(handle)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = imgRef.current.offsetWidth || imgRef.current.naturalWidth || 0
    const startHeight = imgRef.current.offsetHeight || imgRef.current.naturalHeight || 0
    const aspectRatio = startWidth > 0 && startHeight > 0 ? startWidth / startHeight : 1

    // 현재 state 값도 가져오기 (이미 리사이징된 경우)
    const currentWidth = width || startWidth
    const currentHeight = height || startHeight
    const actualStartWidth = currentWidth !== startWidth ? currentWidth : startWidth
    const actualStartHeight = currentHeight !== startHeight ? currentHeight : startHeight
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()
      moveEvent.stopPropagation()
      
      if (!imgRef.current || !isResizing) return

      let newWidth = actualStartWidth
      let newHeight = actualStartHeight

      if (handle === 'se') {
        newWidth = actualStartWidth + (moveEvent.clientX - startX)
        newHeight = actualStartHeight + (moveEvent.clientY - startY)
      } else if (handle === 'sw') {
        newWidth = actualStartWidth - (moveEvent.clientX - startX)
        newHeight = actualStartHeight + (moveEvent.clientY - startY)
      } else if (handle === 'ne') {
        newWidth = actualStartWidth + (moveEvent.clientX - startX)
        newHeight = actualStartHeight - (moveEvent.clientY - startY)
      } else if (handle === 'nw') {
        newWidth = actualStartWidth - (moveEvent.clientX - startX)
        newHeight = actualStartHeight - (moveEvent.clientY - startY)
      }

      // 최소 크기 제한
      newWidth = Math.max(50, newWidth)
      newHeight = Math.max(50, newHeight)

      // 비율 유지 (Shift 키를 누르지 않은 경우)
      if (!moveEvent.shiftKey && aspectRatio > 0 && !isNaN(aspectRatio)) {
        newHeight = newWidth / aspectRatio
      }

      const roundedWidth = Math.round(newWidth)
      const roundedHeight = Math.round(newHeight)

      // State를 먼저 업데이트 (React 리렌더링 트리거)
      setWidth(roundedWidth)
      setHeight(roundedHeight)
      
      // 이미지 스타일 직접 업데이트 (즉시 반영)
      if (imgRef.current) {
        imgRef.current.style.width = `${roundedWidth}px`
        imgRef.current.style.height = `${roundedHeight}px`
        imgRef.current.style.maxWidth = 'none'
        imgRef.current.style.maxHeight = 'none'
        imgRef.current.style.minWidth = '0'
        imgRef.current.style.minHeight = '0'
      }
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault()
      upEvent.stopPropagation()
      
      // 최종 크기 가져오기
      const finalWidth = width !== null && width !== undefined ? width : (imgRef.current?.offsetWidth || null)
      const finalHeight = height !== null && height !== undefined ? height : (imgRef.current?.offsetHeight || null)
      
      // 최종 업데이트 - 마우스 업 시에만 노드 속성 업데이트
      if (finalWidth !== null && finalHeight !== null && !isNaN(Number(finalWidth)) && !isNaN(Number(finalHeight))) {
        const numWidth = Math.round(Number(finalWidth))
        const numHeight = Math.round(Number(finalHeight))
        
        try {
          if (updateAttributes) {
            // 노드 속성 업데이트
            updateAttributes({ width: numWidth, height: numHeight })
            
            // state도 최종 값으로 업데이트
            setWidth(numWidth)
            setHeight(numHeight)
          }
        } catch (error) {
          console.error('Error updating attributes on mouse up:', error)
        }
      }
      
      // 리사이징 종료
      setIsResizing(false)
      setResizeHandle(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    // 전역 이벤트 리스너 등록
    document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true })
    document.addEventListener('mouseup', handleMouseUp, { passive: false, capture: true })
    
    // 마우스가 문서 밖으로 나가도 리사이징 종료
    document.addEventListener('mouseleave', handleMouseUp, { once: true, passive: false, capture: true })
  }

  // 리사이징 중이면 state 우선 사용, 아니면 노드 attrs 사용
  const displayWidth = isResizing ? width : (width !== null ? width : (node.attrs.width || null))
  const displayHeight = isResizing ? height : (height !== null ? height : (node.attrs.height || null))

  const imageStyle: React.CSSProperties = {
    display: 'block',
  }

  // 리사이징 중이거나 width가 설정되어 있으면 maxWidth 제거
  if (displayWidth && displayWidth !== null) {
    imageStyle.width = typeof displayWidth === 'number' ? `${displayWidth}px` : displayWidth
    imageStyle.maxWidth = 'none' // width가 설정되면 maxWidth 제거
  } else {
    imageStyle.maxWidth = '100%' // width가 없을 때만 maxWidth 적용
  }

  if (displayHeight && displayHeight !== null) {
    imageStyle.height = typeof displayHeight === 'number' ? `${displayHeight}px` : displayHeight
  } else if (!displayWidth || displayWidth === null) {
    imageStyle.height = 'auto'
  }

  return (
    <NodeViewWrapper
      className={`image-resize-wrapper ${isSelected ? 'selected' : ''}`}
      style={{ 
        display: 'block', 
        position: 'relative', 
        marginLeft: 'auto', 
        marginRight: 'auto', 
        textAlign: 'center',
        width: 'fit-content',
        zIndex: 1 // column 내부에서도 리사이즈 핸들이 보이도록
      }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ''}
        style={imageStyle}
        draggable="false"
        onClick={handleImageClick}
        onDoubleClick={handleImageDoubleClick}
        onMouseDown={(e) => {
          // 리사이즈 핸들이 아닐 때만 선택
          if (!(e.target as HTMLElement).classList.contains('resize-handle')) {
            handleImageClick(e)
          }
        }}
        title="더블클릭하여 이미지 교체"
      />
      <>
        <div
          className="resize-handle resize-handle-se"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            handleMouseDown(e, 'se')
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 12,
            height: 12,
            backgroundColor: '#3b82f6',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nwse-resize',
            zIndex: 10000,
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
        <div
          className="resize-handle resize-handle-sw"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            handleMouseDown(e, 'sw')
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            left: -4,
            bottom: -4,
            width: 12,
            height: 12,
            backgroundColor: '#3b82f6',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nesw-resize',
            zIndex: 10000,
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
        <div
          className="resize-handle resize-handle-ne"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            handleMouseDown(e, 'ne')
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            right: -4,
            top: -4,
            width: 12,
            height: 12,
            backgroundColor: '#3b82f6',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nesw-resize',
            zIndex: 10000,
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
        <div
          className="resize-handle resize-handle-nw"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            handleMouseDown(e, 'nw')
          }}
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          style={{
            position: 'absolute',
            left: -4,
            top: -4,
            width: 12,
            height: 12,
            backgroundColor: '#3b82f6',
            border: '2px solid white',
            borderRadius: '50%',
            cursor: 'nwse-resize',
            zIndex: 10000,
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </>
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          return {
            width: attributes.width,
          }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {}
          }
          return {
            height: attributes.height,
          }
        },
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent)
  },
})
