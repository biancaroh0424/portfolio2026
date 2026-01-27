'use client'

import { formatProjectTitle } from '@/lib/utils'

interface ProjectCardProps {
  project: {
    id: string
    title: string
    period: string
    thumbnail?: string
    tags?: string[]
    keyResult?: string
    duration?: string
    summary?: string
  }
  onClick: () => void
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const displayTitle = formatProjectTitle(project.title)
  
  return (
    <div 
      style={{
        display: 'flex',
        padding: '0 16px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        alignSelf: 'stretch',
        position: 'relative'
      }}
    >
      {/* Top gradient border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(to right, var(--greyscale-700, #222424), var(--greyscale-200, #b3b3b3), var(--greyscale-700, #222424))'
        }}
      />
      {/* Bottom gradient border */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(to right, var(--greyscale-700, #222424), var(--greyscale-200, #b3b3b3), var(--greyscale-700, #222424))'
        }}
      />
      {/* Product Details - max-width: 1160px, border-right/left, gap: 24px */}
      <div
        className="flex-col tablet:flex-row"
        style={{
          display: 'flex',
          maxWidth: '1160px',
          justifyContent: 'center',
          alignItems: 'center',
          alignContent: 'center',
          rowGap: '16px',
          flex: '1 0 0',
          flexWrap: 'wrap',
          borderRight: '1px solid #46474A',
          borderLeft: '1px solid #46474A',
          gap: '24px',
          cursor: 'pointer'
        }}
        onClick={onClick}
      >
        {/* Title + key result summary + tag - min-width: 356px, padding: 24px 16px 16px 16px */}
        <div
          className="tablet:min-w-[356px] w-full"
          style={{
            display: 'flex',
            padding: '24px 16px 16px 16px',
            flexDirection: 'column',
            gap: '24px',
            flex: '1 0 0'
          }}
        >
          <div className="flex flex-col gap-2">
            {/* Duration - 제목 위에 표시 */}
            {project.duration && project.duration.trim() && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '8px',
                  alignSelf: 'stretch',
                  marginBottom: '0px'
                }}
              >
                <p
                  style={{
                    color: 'var(--text-tertiary, #E6E6E6)',
                    fontFamily: 'galmuri, monospace',
                    fontSize: '12px',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    lineHeight: 'normal',
                    margin: 0
                  }}
                >
                  {project.duration}
                </p>
              </div>
            )}
            
            {/* Title */}
            <h3 
              style={{
                color: 'var(--text-primary, #FFF)',
                fontFamily: '"Noto Serif KR", serif',
                fontSize: '24px',
                fontStyle: 'normal',
                fontWeight: 600,
                lineHeight: '140%',
                textDecoration: 'none'
              }}
            >
              {displayTitle}
            </h3>
          </div>
          {/* Project Summary - ul 리스트 */}
          {project.summary && project.summary.trim() && (
            <ul
              style={{
                listStyle: 'disc',
                paddingLeft: '20px',
                margin: 0,
                color: 'var(--text-label, #E6E6E6)',
                fontFamily: '"Pretendard Variable"',
                fontSize: '14px',
                fontStyle: 'normal',
                fontWeight: 400,

              }}
            >
              {project.summary.split('\n').filter(line => line.trim()).map((item, index) => (
                <li key={index} style={{ 
                  lineHeight: '160%',
                  marginBottom: '0px'
                }}>
                  {item.trim()}
                </li>
              ))}
            </ul>
          )}

          {/* Key Result Summary */}
          {project.keyResult && (
            <p
              style={{
                color: 'var(--text-label, #E6E6E6)',
                fontFamily: '"Pretendard Variable"',
                fontSize: '14px',
                fontStyle: 'normal',
                fontWeight: 400,
                lineHeight: '160%',
                marginBottom: '0px !important',
              }}
            >
              {project.keyResult}
            </p>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {project.tags.map((tag, index) => (
                <span
                  key={index}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-label, #E6E6E6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail - width: 412px, height: 260px, padding: 16px */}
        <div
          className="tablet:w-[412px] tablet:h-[260px] w-full"
          style={{
            display: 'flex',
            padding: '16px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            aspectRatio: '412 / 260'
          }}
        >
          {project.thumbnail ? (
            <img 
              src={project.thumbnail} 
              alt={project.title} 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '0px'
              }}
            />
          ) : (
            <div 
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#E5E5E5',
                borderRadius: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '14px'
              }}
            >
              Project Image
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

