// CMS 데이터 관리 - JSON 파일에서 읽어오거나 API에서 가져올 수 있음
import fs from 'fs/promises'
import path from 'path'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')

let cachedProjects: any[] | null = null

async function loadProjectsData(): Promise<any[]> {
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
}

export interface ProjectTranslation {
  title: string
  content?: string // HTML 형식의 전체 콘텐츠
  fields?: ProjectField[] // 동적 필드 배열
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
  language?: 'en' | 'ko' | 'it' // 콘텐츠 언어
}

export async function getProjects(): Promise<Project[]> {
  // 실제로는 API 호출이나 파일 읽기
  // thumbnail과 image가 null인 경우 undefined로 변환
  const projectsData = await loadProjectsData()
  return projectsData.map(project => ({
    ...project,
    thumbnail: project.thumbnail === null ? undefined : project.thumbnail,
    sections: project.sections?.map(section => ({
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
      
      // translations에서 콘텐츠 추출
      let projectContent = ''
      
      if (translation.content) {
        projectContent = translation.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      } else {
        projectContent = translation.title || ''
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
    
    // 각 언어별로 content에서 h1-h6 태그 추출하여 개별 콘텐츠로 저장
    languages.forEach(lang => {
      const translation = translations[lang]
      const contentToProcess = translation?.content || (lang === 'en' ? project.content : null)
      
      if (!contentToProcess) return
      
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
      
      // HTML에서 h1-h6 태그 찾기
      const headingPattern = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi
      let headingMatch
      const seenAnchors = new Set<string>()
      
      while ((headingMatch = headingPattern.exec(contentToProcess)) !== null) {
        const level = parseInt(headingMatch[1], 10)
        const headingText = headingMatch[2].replace(/<[^>]*>/g, '').trim()
        
        if (headingText && headingText.length > 0) {
          // anchor 생성: 제목을 소문자로 변환하고 공백을 하이픈으로, 특수문자 제거
          const anchorBase = headingText
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          
          // 고유한 anchor 생성
          let anchor = anchorBase
          let counter = 1
          while (seenAnchors.has(anchor)) {
            anchor = `${anchorBase}-${counter}`
            counter++
          }
          seenAnchors.add(anchor)
          
          // 해당 heading 이후의 내용 추출 (다음 heading 전까지)
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
            // fields 정보도 heading 콘텐츠에 포함
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
              language: lang
            })
          }
        }
      }
    })
  })
  
  return content
}

