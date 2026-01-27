'use client'

import { useState } from 'react'

interface ChatHistoryItemProps {
  id: string
  title: string
  isActive?: boolean
  onClick?: () => void
  onDelete?: (id: string) => void
  showDeleteButton?: boolean
}

export default function ChatHistoryItem({
  id,
  title,
  isActive = false,
  onClick,
  onDelete,
  showDeleteButton = true
}: ChatHistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete) {
      onDelete(id)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onClick) {
      onClick()
    }
  }

  return (
    <div
      className="flex items-center cursor-pointer transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      style={{
        display: 'flex',
        width: '100%',
        height: 'fit-content',
        padding: '8px',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '8px',
        backgroundColor: isActive 
          ? 'var(--fill-white-10)' 
          : isHovered 
            ? 'var(--dropdownList-hovered, rgba(255, 255, 255, 0.10))' 
            : 'transparent'
      }}
    >
      <span
        className="flex-1 min-w-0"
        style={{
          color: 'var(--text-primary)',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '14px'
        }}
        title={title}
      >
        {title}
      </span>
      {showDeleteButton && (
        <button
          onClick={handleDelete}
          className="flex-shrink-0 transition-opacity"
          style={{ 
            color: 'var(--text-primary)',
            width: '14px',
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered || isActive ? 1 : 0
          }}
          title="Delete chat"
          aria-label="Delete chat"
        >
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 14 14" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
