// CMS 데이터 관리 - JSON 파일에서 읽어오거나 Vercel Blob(프로덕션)에서 가져옴
import fs from 'fs/promises'
import path from 'path'
import { list } from '@vercel/blob'
import { stripPortfolioVectorOnlyHtml } from '@/lib/strip-portfolio-vector-only'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')
const BLOB_PROJECTS_PATH = 'data/projects.json'

let cachedProjects: any[] | null = null

/** 프로덕션(Vercel)에서 Blob 저장소 사용 여부 */
function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

/** Vercel Blob에서 projects.json 읽기 (프로덕션 전용 — pathname 변형 모두 허용) */
async function readProjectsFromBlob(): Promise<any[] | null> {
  try {
    const { blobs } = await list({ prefix: 'data/', limit: 20 })
    const pathnames = blobs.map((b) => (b as { pathname?: string }).pathname ?? '').filter(Boolean)
    if (process.env.VERCEL === '1') console.log('[data] production Blob list:', blobs.length, 'blob(s), pathnames:', pathnames.slice(0, 5).join(', ') || '(none)')
    const blob =
      blobs.find((b) => (b as { pathname?: string }).pathname === BLOB_PROJECTS_PATH) ??
      blobs.find((b) => (b as { pathname?: string }).pathname === `/${BLOB_PROJECTS_PATH}`) ??
      blobs.find((b) => (b as { pathname?: string }).pathname?.endsWith?.('projects.json')) ??
      blobs.find((b) => (b as { pathname?: string }).pathname?.includes?.('projects.json'))
    if (!blob?.url) {
      if (process.env.VERCEL === '1') console.warn('[data] production: no projects.json blob in data/. Save a project from Admin first so Blob has data/projects.json.')
      return null
    }
    const url = (blob.url as string) + ((blob.url as string).includes('?') ? '&' : '?') + '_=' + Date.now()
    const res = await fetch(url)
    if (!res.ok) {
      if (process.env.VERCEL === '1') console.warn('[data] production Blob fetch not ok:', res.status)
      return null
    }
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch (e) {
    if (process.env.VERCEL === '1') console.warn('[data] production readProjectsFromBlob error:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/** 프로덕션에서만 사용: 같은 앱의 GET /api/admin/projects 호출 (Blob 실패 시 fallback) */
async function readProjectsFromApi(): Promise<any[] | null> {
  // 프로덕션에서는 VERCEL_URL만 사용 (localhost 제외)
  const base =
    process.env.VERCEL === '1'
      ? (process.env.VERCEL_URL && `https://${String(process.env.VERCEL_URL).replace(/^https?:\/\//, '')}`) ||
        process.env.NEXT_PUBLIC_VERCEL_URL ||
        process.env.NEXT_PUBLIC_APP_URL
      : process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'
  if (!base) {
    if (process.env.VERCEL === '1') console.warn('[data] production: no base URL for API (VERCEL_URL / NEXT_PUBLIC_VERCEL_URL)')
    return null
  }
  const url = `${base.replace(/\/$/, '')}/api/admin/projects`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      if (process.env.VERCEL === '1') console.warn('[data] production readProjectsFromApi failed:', res.status, url)
      return null
    }
    const json = await res.json()
    return Array.isArray(json) ? json : null
  } catch (e) {
    if (process.env.VERCEL === '1') console.warn('[data] production readProjectsFromApi error:', e instanceof Error ? e.message : String(e), url)
    return null
  }
}

async function loadProjectsData(): Promise<any[]> {
  // 프로덕션(Vercel+Blob): Blob 우선(같은 서버에서 토큰 사용), 실패 시 API. 파일 fallback 금지.
  if (isBlobStorageEnabled()) {
    let data = await readProjectsFromBlob()
    if (data === null) data = await readProjectsFromApi()
    if (data !== null) {
      if (process.env.VERCEL === '1') console.log('[data] loadProjectsData: loaded', data.length, 'projects (Blob or API)')
      return data
    }
    if (process.env.VERCEL === '1') {
      console.error(
        '[data] CRITICAL (production): Blob and API both failed. Set BLOB_READ_WRITE_TOKEN in Vercel env, then save at least one project from Admin so data/projects.json exists in Blob.'
      )
    }
    return []
  }

  if (cachedProjects) {
    return cachedProjects
  }

  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    cachedProjects = JSON.parse(data)
    return Array.isArray(cachedProjects) ? cachedProjects : []
  } catch (error) {
    console.error('Error loading projects.json:', error)
    return []
  }
}

export interface ProjectField {
  label: string
  value: string
  type?: 'default' | 'note' | 'note_warning' | 'duration' | 'summary'
}

export interface ProjectTranslation {
  title: string
  /** 썸네일 배너 타이틀 아래 서브타이틀 (언어별, CMS 편집 → RAG/챗봇 검색에 포함) */
  bannerSubtitle?: string
  content?: string // HTML 형식의 전체 콘텐츠
  fields?: ProjectField[] // 동적 필드 배열
  tags?: string[] // 언어별 태그 배열
}

export interface Project {
  id: string
  thumbnail?: string
  currentLanguage?: 'en' | 'ko' | 'it' // 현재 편집 중인 언어 (기본값: 'en')
  updatedAt?: string // ISO 8601 형식의 업데이트 시간
  tags?: string[] // 프로젝트 태그 배열
  translations?: {
    en?: ProjectTranslation
    ko?: ProjectTranslation
    it?: ProjectTranslation
  }
  sections?: Array<{ // 하위 호환성을 위해 유지
    id: string
    title: string
    content: string | string[]
    image?: string
  }>
  // 하위 호환성을 위한 기존 필드들 (deprecated, translations로 마이그레이션 필요)
  title?: string
  content?: string
  fields?: ProjectField[]
  language?: 'en' | 'ko' | 'it'
  subtitle?: string
  period?: string
  company?: string
  scope?: string
  team?: string
  keyResult?: string
  etc?: string
}

export interface Resume {
  en?: string // 영어 Resume PDF 파일 경로
  ko?: string // 한국어 Resume PDF 파일 경로
  it?: string // 이탈리아어 Resume PDF 파일 경로
  content?: string // HTML 콘텐츠 (있을 경우 페이지에 렌더)
}

export interface Content {
  id: string
  type: 'project' | 'about' | 'general' | 'resume'
  title: string
  content: string
  projectId?: string
  anchor?: string
  /** 1-based 순서. 제목이 바뀌어도 안정적인 앵커용 (heading-1, heading-2) */
  headingIndex?: number
  language?: 'en' | 'ko' | 'it' // 콘텐츠 언어
}

export async function getProjects(): Promise<Project[]> {
  // 실제로는 API 호출이나 파일 읽기
  // thumbnail과 image가 null인 경우 undefined로 변환
  const projectsData = await loadProjectsData()
  type SectionShape = { id: string; title: string; content: string | string[]; image?: string | null }
  return projectsData.map((project: Record<string, unknown>) => ({
    ...project,
    thumbnail: project.thumbnail === null ? undefined : project.thumbnail,
    sections: (project.sections as SectionShape[] | undefined)?.map((section: SectionShape) => ({
      ...section,
      image: 'image' in section && section.image === null ? undefined : ('image' in section ? section.image : undefined)
    }))
  })) as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  const projects = await getProjects()
  return projects.find(p => p.id === id) || null
}

export async function getResume(): Promise<Resume | null> {
  try {
    const resumeData = await import('@/data/resume.json')
    return resumeData.default || null
  } catch (error) {
    console.warn('Resume data not found:', error)
    return null
  }
}

export async function getAllContent(): Promise<Content[]> {
  // 프로젝트 내용을 Content 형식으로 변환
  const projects = await getProjects()
  const content: Content[] = []
  
  // Resume 데이터 추가
  const resume = await getResume()
  if (resume && resume.content) {
    const resumeText = resume.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    if (resumeText.length > 0) {
      content.push({
        id: 'resume',
        type: 'resume',
        title: 'Resume',
        content: resumeText,
        language: 'en' // resume은 기본적으로 영어
      })
    }
  }
  
  projects.forEach(project => {
    // translations 구조를 지원하도록 수정
    const translations = project.translations || {}
    const languages: ('en' | 'ko' | 'it')[] = ['en', 'ko', 'it']
    
    // 각 언어별로 콘텐츠 저장
    languages.forEach(lang => {
      const translation = translations[lang]
      if (!translation) {
        // 하위 호환성: 기존 구조 사용
        if (lang === 'en' && (project.title || project.content || project.fields)) {
          // 기존 프로젝트는 영어로만 저장
          let projectContent = ''
          
          if (project.content) {
            projectContent = project.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          } else if (project.title) {
            projectContent = `${project.title}. ${project.subtitle || ''} Period: ${project.period || ''}`
          }
          
          // 태그 추가
          const tags = project.tags || []
          if (tags.length > 0) {
            projectContent += ` Tags: ${tags.join(', ')}`
          }
          
          // fields 내용 추가 (duration, summary, key result 등 포함)
          if (project.fields && project.fields.length > 0) {
            const fieldsText = project.fields
              .map(field => {
                // label이 없어도 value가 있으면 포함 (duration, summary 등)
                if (field.value && field.value.trim()) {
                  if (field.label && field.label.trim()) {
                    return `${field.label}: ${field.value}`
                  } else {
                    // type이 있으면 type 정보 포함
                    if (field.type === 'duration') {
                      return `Duration: ${field.value}`
                    } else if (field.type === 'summary') {
                      return `Summary: ${field.value}`
                    } else {
                      return field.value
                    }
                  }
                }
                return ''
              })
              .filter(text => text.length > 0)
              .join(' ')
            if (fieldsText) {
              projectContent += ' ' + fieldsText
            }
          }
          
          if (projectContent.trim()) {
            content.push({
              id: `project-${project.id}-${lang}`,
              type: 'project',
              title: project.title || '프로젝트',
              content: projectContent.trim(),
              projectId: project.id,
              language: lang
            })
          }
        }
        return
      }
      
      // translations에서 콘텐츠 추출 (영어는 비어있거나 짧을 때 legacy 또는 ko/it 본문 사용)
      const MIN_SUBSTANTIAL_LENGTH = 400 // 플레이스홀더와 구분
      let projectContent = ''
      let rawContent: string | undefined = translation.content || (lang === 'en' ? project.content : undefined)
      if (lang === 'en') {
        const plain = (rawContent && typeof rawContent === 'string' ? rawContent : '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (!plain || plain.length < MIN_SUBSTANTIAL_LENGTH) {
          const fallback = (translations.ko?.content || translations.it?.content) as string | undefined
          if (fallback && typeof fallback === 'string') rawContent = fallback
        }
      }
      if (rawContent) {
        projectContent = (typeof rawContent === 'string' ? rawContent : '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      if (!projectContent) {
        projectContent = translation.title || ''
      }
      // 영문 본문이 여전히 짧으면 ko/it fallback 한 번 더 (요약 청크에 본문 반드시 포함)
      if (lang === 'en' && projectContent.length < MIN_SUBSTANTIAL_LENGTH) {
        const fb = (translations.ko?.content || translations.it?.content) as string | undefined
        if (fb && typeof fb === 'string') {
          projectContent = fb.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        }
      }
      
      // 태그 추가
      const tags = translation.tags || (lang === 'en' ? project.tags : [])
      if (tags && tags.length > 0) {
        projectContent += ` Tags: ${tags.join(', ')}`
      }
      
      // fields 내용 추가 (duration, summary, key result 등 포함)
      if (translation.fields && translation.fields.length > 0) {
        const fieldsText = translation.fields
          .map(field => {
            // label이 없어도 value가 있으면 포함 (duration, summary 등)
            if (field.value && field.value.trim()) {
              if (field.label && field.label.trim()) {
                return `${field.label}: ${field.value}`
              } else {
                // type이 있으면 type 정보 포함
                if (field.type === 'duration') {
                  return `Duration: ${field.value}`
                } else if (field.type === 'summary') {
                  return `Summary: ${field.value}`
                } else {
                  return field.value
                }
              }
            }
            return ''
          })
          .filter(text => text.length > 0)
          .join(' ')
        if (fieldsText) {
          projectContent += ' ' + fieldsText
        }
      }
      
      const banner = (translation.bannerSubtitle || '').trim()
      if (banner) {
        projectContent = projectContent.trim()
          ? `${banner}. ${projectContent.trim()}`
          : banner
      }

      if (projectContent.trim()) {
        content.push({
          id: `project-${project.id}-${lang}`,
          type: 'project',
          title: translation.title,
          content: projectContent.trim(),
          projectId: project.id,
          language: lang
        })
      }
    })
    
    // 프로젝트 섹션들도 개별적으로 저장 (더 세밀한 검색을 위해)
    // sections는 하위 호환성을 위한 것이므로, 프로젝트의 기본 언어(영어)로 저장
    project.sections?.forEach(section => {
      const sectionContent = Array.isArray(section.content) 
        ? section.content.join(' ') 
        : section.content
      
      if (sectionContent && sectionContent.trim().length > 0) {
        content.push({
          id: `section-${project.id}-${section.id}`,
          type: 'project',
          title: `${project.title} - ${section.title}`,
          content: sectionContent.trim(),
          projectId: project.id,
          anchor: `section-${section.id}`,
          language: 'en' // sections는 기본적으로 영어로 저장 (하위 호환성)
        })
      }
    })
    
    // 각 언어별로 content에서 h1-h6 태그 추출 (영어는 비어있거나 짧을 때 project.content 또는 ko/it 본문 사용)
    const MIN_SUBSTANTIAL_LENGTH = 400
    languages.forEach(lang => {
      const translation = translations[lang]
      let contentToProcess: string | null =
        ((translation?.content && translation.content.trim()) ? translation.content : (lang === 'en' ? project.content : null)) ?? null
      if (lang === 'en') {
        const fallback = (translations.ko?.content || translations.it?.content) as string | undefined
        const useFallback =
          !contentToProcess ||
          !contentToProcess.trim() ||
          contentToProcess.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length < MIN_SUBSTANTIAL_LENGTH
        if (useFallback && fallback && typeof fallback === 'string') contentToProcess = fallback
      }
      if (!contentToProcess || !contentToProcess.trim()) return

      // RAG 전용 블록(data-portfolio-vector-only) 안의 헤딩은 공개 목차/앵커에 쓰이지 않도록 제외
      contentToProcess = stripPortfolioVectorOnlyHtml(contentToProcess)
      if (!contentToProcess.trim()) return
      
      // fields 정보를 텍스트로 변환 (heading 콘텐츠에도 포함)
      const fields = translation?.fields || (lang === 'en' ? project.fields : [])
      let fieldsTextForHeadings = ''
      if (fields && fields.length > 0) {
        const fieldsText = fields
          .map(field => {
            if (field.label) {
              if (field.value && field.value.trim()) {
                return `${field.label}: ${field.value}`
              } else {
                return field.label
              }
            }
            return ''
          })
          .filter(text => text.length > 0)
          .join(' ')
        if (fieldsText) {
          fieldsTextForHeadings = fieldsText
        }
      }
      
      // HTML에서 h1-h6 태그 찾기 (위치 기반 headingIndex로 제목 변경 시에도 앵커 유지)
      const headingPattern = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi
      let headingMatch
      const seenAnchors = new Set<string>()
      let headingIndex = 0

      while ((headingMatch = headingPattern.exec(contentToProcess)) !== null) {
        const level = parseInt(headingMatch[1], 10)
        const headingText = headingMatch[2].replace(/<[^>]*>/g, '').trim()
        
        if (headingText && headingText.length > 0) {
          headingIndex += 1
          // anchor(슬러그) 생성: 제목 기반 (하위 호환)
          const anchorBase = headingText
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          let anchor = anchorBase
          let counter = 1
          while (seenAnchors.has(anchor)) {
            anchor = `${anchorBase}-${counter}`
            counter++
          }
          seenAnchors.add(anchor)
          
          const headingEndIndex = headingMatch.index + headingMatch[0].length
          const nextHeadingMatch = contentToProcess.substring(headingEndIndex).match(/<h[1-6][^>]*>/i)
          const contentEndIndex = nextHeadingMatch && nextHeadingMatch.index !== undefined
            ? headingEndIndex + nextHeadingMatch.index 
            : contentToProcess.length
          
          const headingContent = contentToProcess
            .substring(headingEndIndex, contentEndIndex)
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          
          if (headingContent && headingContent.length > 0) {
            const fullHeadingContent = fieldsTextForHeadings 
              ? `${headingText}. ${headingContent} ${fieldsTextForHeadings}`
              : `${headingText}. ${headingContent}`
            
            const projectTitle = translation?.title || project.title || '프로젝트'
            
            content.push({
              id: `heading-${project.id}-${lang}-${anchor}`,
              type: 'project',
              title: `${projectTitle} - ${headingText}`,
              content: fullHeadingContent,
              projectId: project.id,
              anchor: anchor,
              headingIndex,
              language: lang
            })
          }
        }
      }
    })
  })
  
  return content
}

