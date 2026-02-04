'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import RichTextEditor from '@/components/RichTextEditor'
import { formatProjectTitle } from '@/lib/utils'

interface ProjectField {
  label: string
  value: string
  type?: 'default' | 'note' | 'note_warning' | 'duration' | 'summary'
}

interface ProjectTranslation {
  title: string
  content?: string // HTML 형식의 전체 콘텐츠
  fields?: ProjectField[] // 동적 필드 배열
  tags?: string[] // 언어별 태그 배열
}

interface Project {
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
  // 하위 호환성을 위한 기존 필드들 (deprecated, translations로 마이그레이션 필요)
  title?: string
  content?: string
  fields?: ProjectField[]
  language?: 'en' | 'ko' | 'it'
}

// 현재 언어의 콘텐츠를 가져오는 헬퍼 함수
const getCurrentTranslation = (project: Project, language: 'en' | 'ko' | 'it'): ProjectTranslation => {
  // 해당 언어의 translation이 있으면 반환
  if (project.translations?.[language]) {
    return {
      title: project.translations[language].title || '',
      content: project.translations[language].content || '',
      fields: project.translations[language].fields || [],
      tags: project.translations[language].tags || []
    }
  }
  // 하위 호환성: 기존 프로젝트는 title, content, fields를 사용 (영어로만 저장된 경우)
  // 단, 현재 언어가 영어일 때만 하위 호환성 적용
  if (language === 'en' && (project.title || project.content || project.fields)) {
    // 기존 프로젝트의 tags를 영어 translation에 포함 (하위 호환성)
    return {
      title: project.title || '',
      content: project.content || '',
      fields: project.fields || [],
      tags: project.tags || []
    }
  }
  // 해당 언어의 translation이 없으면 빈값 반환
  return {
    title: '',
    content: '',
    fields: [],
    tags: []
  }
}

// 현재 언어의 콘텐츠를 설정하는 헬퍼 함수
const setCurrentTranslation = (
  project: Project,
  language: 'en' | 'ko' | 'it',
  translation: ProjectTranslation
): Project => {
  return {
    ...project,
    currentLanguage: language,
    tags: project.tags || [], // tags 명시적으로 보존
    translations: {
      ...project.translations,
      [language]: translation
    }
  }
}

export default function AdminPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [currentEditLanguage, setCurrentEditLanguage] = useState<'en' | 'ko' | 'it'>('en')
  const [isSaving, setIsSaving] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [message, setMessage] = useState('')
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<'projects' | 'resume' | 'analytics'>('projects')
  const [resumeFiles, setResumeFiles] = useState<{ en?: string; ko?: string; it?: string }>({})
  const [isLoadingResume, setIsLoadingResume] = useState(false)
  const [uploadingResume, setUploadingResume] = useState<{ en: boolean; ko: boolean; it: boolean }>({ en: false, ko: false, it: false })
  const [tagInput, setTagInput] = useState<string>('')
  const editorContentRef = useRef<string | null>(null)
  const editorGetContentRef = useRef<(() => string) | null>(null)
  /** 저장 직후 loadProjects로 effect가 돌 때, 같은 프로젝트면 언어/에디터 상태 덮어쓰지 않음 */
  const preserveEditStateAfterSaveRef = useRef<string | null>(null)
  /** 현재 언어의 title/fields 등 최신값 (필드 삭제 후 저장 시 클로저보다 이걸 우선 사용) */
  const currentTranslationRef = useRef<ProjectTranslation | null>(null)

  // 페이지 로드 시 로그인 상태 확인
  useEffect(() => {
    const checkAuth = () => {
      const savedAuth = localStorage.getItem('admin_authenticated')
      if (savedAuth === 'true') {
        setIsAuthenticated(true)
      }
      setIsCheckingAuth(false)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects()
      loadResume()
    }
  }, [isAuthenticated])

  // 저장 시 사용하는 ref: 태그/필드 추가·삭제 시에도 최신 translation 반영되도록 editingProject 전체 의존
  useEffect(() => {
    if (editingProject) {
      currentTranslationRef.current = getCurrentTranslation(editingProject, currentEditLanguage)
    } else {
      currentTranslationRef.current = null
    }
  }, [editingProject, currentEditLanguage])

  const loadResume = async () => {
    setIsLoadingResume(true)
    try {
      const response = await fetch('/api/admin/resume')
      if (response.ok) {
        const data = await response.json()
        setResumeFiles({
          en: data.en || '',
          ko: data.ko || '',
          it: data.it || ''
        })
      }
    } catch (error) {
      console.error('Error loading resume:', error)
    } finally {
      setIsLoadingResume(false)
    }
  }

  // 벡터 저장소 재초기화 헬퍼 (재시도 포함). 실패 시 API의 error/hint 반환.
  const initializeVectorStoreWithRetry = async (maxRetries = 3): Promise<{ success: boolean; errorMessage?: string; contentsCount?: number; chunksCount?: number }> => {
    const timeoutMs = 320_000 // 서버 maxDuration 300초까지 기다림 (504 전에 클라이언트에서 끊지 않도록)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        setIsInitializing(true)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        const embedResponse = await fetch('/api/embed', { method: 'POST', signal: controller.signal })
        clearTimeout(timeoutId)
        const result = await embedResponse.json().catch(() => ({}))
        if (embedResponse.ok && result.success) {
          return { success: true, contentsCount: result.contentsCount, chunksCount: result.chunksCount }
        }
        // 504 Gateway Timeout: Vercel 함수 타임아웃 (Hobby 10초, Pro 60초). 재시도해도 동일하면 안내 메시지.
        if (embedResponse.status === 504) {
          const timeoutMsg = '벡터 저장소 초기화가 시간 초과(504)되었습니다. 이 라우트는 최대 300초까지 설정돼 있습니다. Vercel 대시보드 → Settings → Functions에서 Function Max Duration이 300 이상인지 확인해 주세요. (Fluid Compute 사용 시 Pro 기본 300초.) 챗봇은 이전 인덱스를 사용하며, 나중에 다시 시도해 주세요.'
          if (attempt === maxRetries) return { success: false, errorMessage: timeoutMsg }
          console.warn(`Vector store init failed (504), retrying... (${attempt}/${maxRetries})`)
          await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }
        const msg = [result.error, result.hint, result.details].filter(Boolean).join(' — ')
        if (msg && attempt === maxRetries) return { success: false, errorMessage: msg }
        if (attempt < maxRetries) {
          console.log(`Vector store init failed, retrying... (${attempt}/${maxRetries})`, result.error || result.details)
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        } else {
          return { success: false, errorMessage: msg || result.details || '벡터 저장소 업데이트 실패' }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        const isAbort = (error instanceof Error && error.name === 'AbortError') || /abort/i.test(errMsg)
        console.error(`Error initializing vector store (attempt ${attempt}):`, error)
        if (attempt === maxRetries) {
          return { success: false, errorMessage: isAbort ? '요청 시간 초과. 벡터 저장소 초기화는 최대 300초 걸릴 수 있습니다. Vercel Settings → Functions → Max Duration을 확인해 주세요.' : errMsg }
        }
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      } finally {
        setIsInitializing(false)
      }
    }
    return { success: false, errorMessage: '벡터 저장소 업데이트 실패' }
  }

  const handleSaveResume = async () => {
    setIsSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/resume', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resumeFiles),
      })

      if (!response.ok) {
        throw new Error('Failed to save resume')
      }

      setMessage('✅ Resume PDF 파일 경로가 저장되었습니다!')
    } catch (error) {
      console.error('Error saving resume:', error)
      setMessage('❌ 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResumeUpload = async (language: 'en' | 'ko' | 'it', file: File) => {
    setUploadingResume(prev => ({ ...prev, [language]: true }))
    setMessage('')
    
    try {
      const formData = new FormData()
      formData.append('pdf', file)

      const uploadResponse = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload PDF')
      }

      const { url } = await uploadResponse.json()
      
      // 업로드된 파일 경로를 해당 언어에 저장
      setResumeFiles(prev => ({
        ...prev,
        [language]: url
      }))

      setMessage(`✅ ${language.toUpperCase()} Resume PDF가 업로드되었습니다! 저장 버튼을 눌러주세요.`)
    } catch (error) {
      console.error('Error uploading resume:', error)
      setMessage(`⚠️ ${language.toUpperCase()} Resume PDF 업로드에 실패했습니다.`)
    } finally {
      setUploadingResume(prev => ({ ...prev, [language]: false }))
    }
  }

  const handleLogin = () => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin2026'
    if (password === adminPassword) {
      setIsAuthenticated(true)
      setError('')
      // 로컬 스토리지에 로그인 상태 저장
      localStorage.setItem('admin_authenticated', 'true')
    } else {
      setError('비밀번호가 올바르지 않습니다.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('admin_authenticated')
  }

  const loadProjects = async () => {
    try {
      // API를 통해 최신 프로젝트 데이터 가져오기 (캐시 없이, 타임스탬프 추가)
      const timestamp = Date.now()
      const response = await fetch(`/api/admin/projects?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to load projects')
      }
      
      const data = await response.json()
      
      // 하위 호환성: 기존 프로젝트를 translations 구조로 변환
      const projectsWithTranslations = data.map((project: Project) => {
        // 이미 translations가 있으면 그대로 사용 (tags 보존)
        if (project.translations) {
          return {
            ...project,
            tags: project.tags || []
          }
        }
        // 기존 구조를 translations로 변환
        const language = project.language || 'en'
        return {
          ...project,
          currentLanguage: language,
          updatedAt: project.updatedAt || new Date(0).toISOString(), // updatedAt이 없으면 과거 시간으로 설정
          tags: project.tags || [], // tags 보존
          translations: {
            [language]: {
              title: project.title || '',
              content: project.content || '',
              fields: project.fields || []
            }
          }
        }
      })
      
      // updatedAt 기준으로 최신순 정렬 (최신이 위에)
      const sortedProjects = projectsWithTranslations.sort((a: { updatedAt?: string }, b: { updatedAt?: string }) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return timeB - timeA // 내림차순 (최신이 위)
      })
      
      setProjects(sortedProjects)
      return sortedProjects
    } catch (error) {
      console.error('Error loading projects:', error)
      return []
    }
  }

  const handleImageUpload = async (file: File, type: 'thumbnail' | 'section', sectionIndex?: number) => {
    setUploadingImage(type === 'thumbnail' ? 'thumbnail' : `section-${sectionIndex}`)
    
    try {
      console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', file.size)
      
      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', type)

      console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `${value.name} (${value.type})` : value]))

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const data = await response.json()
      const imageUrl = data.url

      if (type === 'thumbnail' && editingProject) {
        setEditingProject({
          ...editingProject,
          thumbnail: imageUrl,
        })
      }

      setMessage('이미지가 업로드되었습니다!')
    } catch (error) {
      console.error('Error uploading image:', error)
      const errorMessage = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.'
      setMessage(`이미지 업로드 실패: ${errorMessage}`)
    } finally {
      setUploadingImage(null)
    }
  }

  const handleSave = async () => {
    if (!editingProject) return

    // 프로젝트 ID 검증
    if (!editingProject.id || editingProject.id.trim() === '') {
      setMessage('❌ 프로젝트 ID를 입력해주세요.')
      setIsSaving(false)
      return
    }

    // 프로젝트 ID 형식 검증 (공백, 특수문자 제한)
    const idPattern = /^[a-z0-9-]+$/
    if (!idPattern.test(editingProject.id.trim())) {
      setMessage('❌ 프로젝트 ID는 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.')
      setIsSaving(false)
      return
    }

    // 입력 중인 태그가 있으면 먼저 editingProject에 추가 (저장 전에 UI에 반영)
    let projectWithTags = editingProject
    if (tagInput.trim().length > 0) {
      const tagValue = tagInput.trim()
      const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
      const updatedTranslation: ProjectTranslation = {
        ...currentTranslation,
        tags: [...(Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []), tagValue]
      }
      projectWithTags = setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation)
      // 즉시 UI에 반영 (저장 전에 태그가 표시되도록)
      setEditingProject(projectWithTags)
      setTagInput('') // 입력 필드 초기화
    }

    setIsSaving(true)
    setMessage('')
    
    // 저장 중에도 태그가 표시되도록 projectWithTags를 확실히 반영
    // (비동기 상태 업데이트가 완료되기 전에 저장이 시작될 수 있으므로)
    if (projectWithTags !== editingProject) {
      setEditingProject(projectWithTags)
    }

    try {
      // 에디터에서 직전에 읽기 (저장 버튼 클릭 시 디바운스 전이라도 최신 반영)
      const latestContent =
        editorGetContentRef.current?.() ??
        editorContentRef.current ??
        getCurrentTranslation(projectWithTags, currentEditLanguage).content ??
        ''
      const baseTranslation = getCurrentTranslation(projectWithTags, currentEditLanguage)
      const fromRef = currentTranslationRef.current
      // fromRef 있으면 fields/title은 ref 기준. tags는 항상 baseTranslation(projectWithTags) 기준으로 저장 (tagInput 병합 반영)
      const updatedTranslation: ProjectTranslation = {
        title: fromRef?.title ?? baseTranslation.title,
        content: latestContent || baseTranslation.content,
        fields: fromRef ? (fromRef.fields ?? []) : (baseTranslation.fields ?? []),
        tags: Array.isArray(baseTranslation.tags) ? baseTranslation.tags : []
      }
      
      // 프로젝트에 현재 언어의 translation만 업데이트하고 다른 언어는 유지
      const projectToSave = {
        ...setCurrentTranslation(projectWithTags, currentEditLanguage, updatedTranslation),
        updatedAt: new Date().toISOString() // 업데이트 시간 추가
      }
      
      const response = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectToSave),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        const msg = errBody?.message || errBody?.error || `HTTP ${response.status}`
        throw new Error(msg)
      }

      // API 응답에서 저장된 프로젝트 데이터 가져오기
      const responseData = await response.json()
      const savedProject = responseData.project || projectToSave

      setMessage('프로젝트가 저장되었습니다. 벡터 저장소를 업데이트하는 중...')
      
      // 저장된 프로젝트로 즉시 editingProject 업데이트 (언어별 태그 포함)
      // 현재 편집 중인 언어 상태도 유지
      const finalProject = {
        ...savedProject,
        currentLanguage: currentEditLanguage // 현재 편집 중인 언어 유지
      }
      
      // 즉시 UI에 반영 (저장한 데이터 그대로 유지)
      setEditingProject(finalProject)
      editorContentRef.current = latestContent || ''
      preserveEditStateAfterSaveRef.current = finalProject.id

      // 목록만 새로고침 (Blob eventual consistency로 GET이 아직 이전 버전을 줄 수 있으므로 editingProject는 덮어쓰지 않음)
      await loadProjects()

      // 벡터 저장소 재생성 (재시도 포함)
      const embedResult = await initializeVectorStoreWithRetry()
      if (embedResult.success) {
        const detail = embedResult.chunksCount != null ? ` (${embedResult.contentsCount ?? 0}개 콘텐츠, ${embedResult.chunksCount}개 청크)` : ''
        setMessage(`✅ 프로젝트가 저장되고 벡터 저장소가 업데이트되었습니다!${detail}`)
      } else {
        setMessage(embedResult.errorMessage ?? '⚠️ 프로젝트는 저장되었지만 벡터 저장소 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error saving project:', error)
      const msg = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.'
      setMessage('❌ ' + msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddNew = () => {
    const newProject: Project = {
      id: '', // 사용자가 직접 입력하도록 빈값으로 시작
      currentLanguage: 'en',
      tags: [], // 태그를 빈 배열로 명시적으로 초기화
      translations: {
        en: {
          title: '',
          content: '',
          fields: []
        }
      }
    }
    setEditingProject(newProject)
    setCurrentEditLanguage('en')
    // URL을 변경하여 브라우저 히스토리에 추가
    router.push('/admin/new')
  }

  const handleEdit = (project: Project) => {
    // 프로젝트를 로드할 때 기본 언어를 결정 (기존 language 필드 또는 'en')
    const defaultLanguage = project.currentLanguage || project.language || 'en'
    
    // 하위 호환성: 기존 tags 필드가 있고 translations에 태그가 없으면 영어 translation에 추가
    let projectToEdit = { ...project }
    if (Array.isArray(project.tags) && project.tags.length > 0) {
      // 영어 translation이 있고 태그가 없으면 기존 tags를 추가
      if (projectToEdit.translations?.en && !projectToEdit.translations.en.tags) {
        projectToEdit = {
          ...projectToEdit,
          translations: {
            ...projectToEdit.translations,
            en: {
              ...projectToEdit.translations.en,
              tags: project.tags
            }
          }
        }
      } else if (!projectToEdit.translations?.en) {
        // 영어 translation이 없으면 생성하고 태그 추가
        projectToEdit = {
          ...projectToEdit,
          translations: {
            ...projectToEdit.translations,
            en: {
              title: project.title || '',
              content: project.content || '',
              fields: project.fields || [],
              tags: project.tags
            }
          }
        }
      }
    }
    
    setEditingProject(projectToEdit)
    setCurrentEditLanguage(defaultLanguage)
    setTagInput('') // 태그 입력 필드 초기화
    // 현재 언어의 콘텐츠를 에디터에 로드 (없으면 빈값)
    const currentTranslation = getCurrentTranslation(projectToEdit, defaultLanguage)
    editorContentRef.current = currentTranslation.content || ''
    // URL을 변경하여 브라우저 히스토리에 추가
    router.push(`/admin/edit/${project.id}`)
  }

  // Command+S / Ctrl+S 키보드 단축키로 저장
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command+S (Mac) 또는 Ctrl+S (Windows/Linux)
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const target = e.target as HTMLElement
        // RichTextEditor(ProseMirror) 안에서는 에디터가 Cmd+S로 직접 저장하므로 여기서는 막기만
        if (target.closest('.ProseMirror')) return

        // 프로젝트 편집 모드: 제목/필드 등에 포커스 있을 때 저장
        if (editingProject && !isSaving && !isInitializing) {
          handleSave()
        }
        // Resume 편집 모드일 때 저장
        else if (activeTab === 'resume' && !isSaving) {
          handleSaveResume()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProject, isSaving, isInitializing, activeTab, resumeFiles])

  // URL 변경 감지하여 편집 모드 관리
  useEffect(() => {
    if (pathname === '/admin') {
      // 메인 admin 페이지로 돌아왔을 때 편집 모드 종료
      setEditingProject(null)
      setActiveTab('projects')
    } else if (pathname === '/admin/new') {
      // 새 프로젝트 페이지
      const newProject: Project = {
        id: '', // 사용자가 직접 입력하도록 빈값으로 시작
        currentLanguage: 'en',
        tags: [], // 태그를 빈 배열로 명시적으로 초기화
        translations: {
          en: {
            title: '',
            content: '',
            fields: []
          }
        }
      }
      setEditingProject(newProject)
      setCurrentEditLanguage('en')
      setTagInput('') // 태그 입력 필드 초기화
    } else if (pathname?.startsWith('/admin/edit/')) {
      // 편집 페이지: 항상 API에서 최신 프로젝트 로드 (목록이 스테일이면 Summary 삭제 후 필드 추가 시 이전 내용이 섞이는 문제 방지)
      const projectId = pathname.replace('/admin/edit/', '').replace(/\/$/, '')
      if (projectId) {
        const loadProject = async () => {
          try {
            const timestamp = Date.now()
            const response = await fetch(`/api/admin/projects?t=${timestamp}`, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
              },
            })
            if (response.ok) {
              const allProjects = await response.json()
              const foundProject = allProjects.find((p: Project) => p.id === projectId)
              if (foundProject) {
                const defaultLanguage = foundProject.currentLanguage || foundProject.language || 'en'
                
                // 하위 호환성: 기존 tags 필드가 있고 translations에 태그가 없으면 영어 translation에 추가
                let projectToEdit = { ...foundProject }
                if (Array.isArray(foundProject.tags) && foundProject.tags.length > 0) {
                  // 영어 translation이 있고 태그가 없으면 기존 tags를 추가
                  if (projectToEdit.translations?.en && !projectToEdit.translations.en.tags) {
                    projectToEdit = {
                      ...projectToEdit,
                      translations: {
                        ...projectToEdit.translations,
                        en: {
                          ...projectToEdit.translations.en,
                          tags: foundProject.tags
                        }
                      }
                    }
                  } else if (!projectToEdit.translations?.en) {
                    // 영어 translation이 없으면 생성하고 태그 추가
                    projectToEdit = {
                      ...projectToEdit,
                      translations: {
                        ...projectToEdit.translations,
                        en: {
                          title: foundProject.title || '',
                          content: foundProject.content || '',
                          fields: foundProject.fields || [],
                          tags: foundProject.tags
                        }
                      }
                    }
                  }
                }
                
                // editingProject가 이미 같은 프로젝트면 업데이트하지 않음
                setEditingProject(prev => {
                  if (prev && prev.id === projectId) {
                    return prev // 저장 후 상태 유지
                  }
                  return projectToEdit
                })
                const preserving = preserveEditStateAfterSaveRef.current === projectId
                if (preserving) preserveEditStateAfterSaveRef.current = null
                if (!preserving) {
                  setCurrentEditLanguage(defaultLanguage)
                  setTagInput('')
                  const currentTranslation = getCurrentTranslation(projectToEdit, defaultLanguage)
                  editorContentRef.current = currentTranslation.content || ''
                  currentTranslationRef.current = currentTranslation
                }
              }
            }
          } catch (error) {
            console.error('Error loading project:', error)
          }
        }
        loadProject()
      }
    }
  }, [pathname, projects])

  // 편집 모드 종료 시 URL 변경
  const handleCancelEdit = () => {
    setEditingProject(null)
    router.push('/admin')
  }

  const handleAddField = () => {
    if (!editingProject) return
    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
    const newField: ProjectField = { label: '', value: '', type: 'default' }
    const updatedFields: ProjectField[] = [...(currentTranslation.fields || []), newField]
    const updatedTranslation: ProjectTranslation = {
      ...currentTranslation,
      fields: updatedFields
    }
    currentTranslationRef.current = updatedTranslation
    setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
  }

  const handleRemoveField = (index: number) => {
    if (!editingProject) return
    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
    const updatedFields = (currentTranslation.fields || []).filter((_, i) => i !== index)
    const updatedTranslation: ProjectTranslation = {
      ...currentTranslation,
      fields: updatedFields
    }
    currentTranslationRef.current = updatedTranslation
    setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
  }

  const handleFieldChange = (index: number, field: 'label' | 'value' | 'type', newValue: string) => {
    if (!editingProject) return
    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
    const baseFields = currentTranslation.fields || []
    const updatedFields: ProjectField[] = baseFields.map((f, i) => {
      if (i !== index) return f
      const next =
        field === 'type'
          ? { ...f, type: (['default', 'note', 'note_warning', 'duration', 'summary'].includes(newValue) ? newValue as ProjectField['type'] : f.type) }
          : { ...f, [field]: newValue }
      if (field === 'type' && (newValue === 'note' || newValue === 'note_warning' || newValue === 'duration' || newValue === 'summary')) {
        return { ...next, label: '' }
      }
      return next as ProjectField
    })
    const updatedTranslation: ProjectTranslation = {
      ...currentTranslation,
      fields: updatedFields
    }
    currentTranslationRef.current = updatedTranslation
    setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
  }


  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 프로젝트를 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/admin/projects/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete project')
      }

      setMessage('프로젝트가 삭제되었습니다. 벡터 저장소를 업데이트하는 중...')
      await loadProjects()

      const embedResult = await initializeVectorStoreWithRetry()
      if (embedResult.success) {
        const detail = embedResult.chunksCount != null ? ` (${embedResult.contentsCount ?? 0}개 콘텐츠, ${embedResult.chunksCount}개 청크)` : ''
        setMessage(`✅ 프로젝트가 삭제되고 벡터 저장소가 업데이트되었습니다!${detail}`)
      } else {
        setMessage(embedResult.errorMessage ?? '⚠️ 프로젝트는 삭제되었지만 벡터 저장소 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      setMessage('❌ 삭제 중 오류가 발생했습니다.')
    }
  }


  // 로그인 상태 확인 중
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen p-8" style={{ paddingTop: '80px' }}>
        <div className="max-w-7xl mx-auto">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="animate-pulse h-9 w-48 bg-gray-700 rounded"></div>
            <div className="flex gap-2">
              <div className="animate-pulse h-10 w-24 bg-gray-700 rounded-lg"></div>
              <div className="animate-pulse h-10 w-32 bg-gray-700 rounded-lg"></div>
            </div>
          </div>
          {/* Tabs skeleton */}
          <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--fill-white-10)' }}>
            <div className="animate-pulse h-10 w-24 bg-gray-700 rounded"></div>
            <div className="animate-pulse h-10 w-24 bg-gray-700 rounded"></div>
            <div className="animate-pulse h-10 w-24 bg-gray-700 rounded"></div>
          </div>
          {/* Content skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse p-6 bg-gray-800 rounded-lg">
                <div className="h-6 w-3/4 bg-gray-700 rounded mb-4"></div>
                <div className="h-4 w-full bg-gray-700 rounded mb-2"></div>
                <div className="h-4 w-5/6 bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // 로그인 페이지
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">Admin Access</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-white">
                관리자 비밀번호를 입력하세요
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                className="w-full px-4 py-2 border rounded-md bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-white"
                style={{ borderColor: 'var(--fill-white-10)' }}
                placeholder="관리자 비밀번호"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    )
  }

  // 편집 모드
  if (editingProject) {
    return (
      <div className="min-h-screen p-8" style={{ paddingTop: '80px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg p-6">
            {/* 상단: 프로젝트 편집 + 취소/저장 — 스크롤 시 상단에 고정 */}
            <div
              className="sticky top-[72px] z-10 flex items-center justify-between mb-6 -mx-6 px-6 py-4 -mt-6 rounded-lg transition-shadow"
              style={{
                background: 'var(--nav-backgroundFill, rgba(18, 19, 19, 0.95))',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <h1 className="text-2xl font-bold text-white">프로젝트 편집</h1>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || isInitializing}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : isInitializing ? '업데이트 중...' : '저장'}
                </button>
              </div>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-lg ${
                message.includes('오류') || message.includes('실패') ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'
              }`}>
                {message}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">프로젝트 ID *</label>
                <input
                  type="text"
                  value={editingProject.id}
                  onChange={(e) => setEditingProject({ ...editingProject, id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg bg-transparent text-white"
                  style={{ borderColor: 'var(--fill-white-10)' }}
                  placeholder="예: rag-chat-builder, my-project"
                  required
                />
                <p className="text-xs text-gray-400 mt-2">
                  프로젝트를 식별하는 고유한 ID를 입력하세요. URL에 사용됩니다. (예: /portfolio/rag-chat-builder)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  태그 (Tags) - {currentEditLanguage === 'en' ? 'English' : currentEditLanguage === 'ko' ? '한국어' : 'Italiano'}
                </label>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg min-h-[48px] items-center" style={{ borderColor: 'var(--fill-white-10)' }}>
                  {(() => {
                    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                    const currentTags = Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []
                    return currentTags.length > 0 && currentTags.map((tag, index) => (
                      <span
                        key={`tag-${index}-${tag}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700 text-gray-300"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => {
                            const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                            const updatedTranslation: ProjectTranslation = {
                              ...currentTranslation,
                              tags: (Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []).filter((_, i) => i !== index)
                            }
                            currentTranslationRef.current = updatedTranslation
                            setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                          }}
                          className="ml-1 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  })()}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      const value = e.target.value
                      setTagInput(value)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const value = tagInput.trim()
                        if (value.length > 0) {
                          const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                          const updatedTranslation: ProjectTranslation = {
                            ...currentTranslation,
                            tags: [...(Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []), value]
                          }
                          currentTranslationRef.current = updatedTranslation
                          setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                          setTagInput('')
                        }
                      } else if (e.key === ',' && tagInput.trim().length > 0) {
                        e.preventDefault()
                        const value = tagInput.trim()
                        const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                        const updatedTranslation: ProjectTranslation = {
                          ...currentTranslation,
                          tags: [...(Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []), value]
                        }
                        currentTranslationRef.current = updatedTranslation
                        setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                        setTagInput('')
                      } else if (e.key === 'Backspace' && tagInput === '') {
                        // 빈 입력창에서 Backspace를 누르면 마지막 태그 삭제
                        const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                        const currentTags = Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []
                        if (currentTags.length > 0) {
                          const updatedTranslation: ProjectTranslation = {
                            ...currentTranslation,
                            tags: currentTags.slice(0, -1)
                          }
                          currentTranslationRef.current = updatedTranslation
                          setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                        }
                      }
                    }}
                    className="flex-1 min-w-[120px] px-2 py-1 bg-transparent text-white border-none outline-none"
                    placeholder={(() => {
                      const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                      const currentTags = Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []
                      return currentTags.length > 0 ? "태그 추가..." : "예: React, Design, UX (Enter 또는 쉼표로 추가)"
                    })()}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  태그를 입력하고 Enter 키나 쉼표(,)를 누르면 추가됩니다. 태그를 클릭하면 삭제할 수 있습니다. 각 언어별로 별도의 태그를 입력할 수 있습니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">언어 *</label>
                <select
                  value={currentEditLanguage}
                  onChange={(e) => {
                    const newLanguage = e.target.value as 'en' | 'ko' | 'it'
                    // 현재 언어의 콘텐츠를 먼저 저장 (editorContentRef에서 가져오기)
                    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                    const currentContent = editorContentRef.current || currentTranslation.content || ''
                    
                    // 현재 언어의 translation 업데이트 (태그 포함)
                    const updatedProject = setCurrentTranslation(editingProject, currentEditLanguage, {
                      title: currentTranslation.title,
                      content: currentContent,
                      fields: currentTranslation.fields || [],
                      tags: Array.isArray(currentTranslation.tags) ? currentTranslation.tags : []
                    })
                    
                    // 선택한 언어의 콘텐츠를 로드
                    const newTranslation = getCurrentTranslation(updatedProject, newLanguage)
                    const newContent = newTranslation.content || ''
                    
                    // 에디터 콘텐츠를 먼저 업데이트
                    editorContentRef.current = newContent
                    
                    // 프로젝트 상태 업데이트 (새 언어로 변경)
                    setEditingProject({
                      ...updatedProject,
                      currentLanguage: newLanguage
                    })
                    
                    // 언어 변경 (이것이 key prop 변경을 트리거하여 RichTextEditor 리마운트)
                    setCurrentEditLanguage(newLanguage)
                    setTagInput('') // 태그 입력 필드 초기화 (언어 변경 시)
                  }}
                  className="w-full px-4 py-2 border rounded-lg bg-transparent text-white"
                  style={{ borderColor: 'var(--fill-white-10)' }}
                  required
                >
                  <option value="en" className="bg-gray-900 text-white">English</option>
                  <option value="ko" className="bg-gray-900 text-white">한국어 (Korean)</option>
                  <option value="it" className="bg-gray-900 text-white">Italiano (Italian)</option>
                </select>
                <p className="text-xs text-gray-400 mt-2">
                  편집할 언어를 선택하세요. 각 언어별로 콘텐츠를 작성할 수 있으며, 저장 시 모든 언어의 콘텐츠가 유지됩니다.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">제목 *</label>
                <input
                  type="text"
                  value={getCurrentTranslation(editingProject, currentEditLanguage).title}
                  onChange={(e) => {
                    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                    const updatedTranslation: ProjectTranslation = {
                      ...currentTranslation,
                      title: e.target.value
                    }
                    currentTranslationRef.current = updatedTranslation
                    setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                  }}
                  className="w-full px-4 py-2 border rounded-lg bg-transparent text-white"
                  style={{ borderColor: 'var(--fill-white-10)' }}
                  required
                />
              </div>

              {/* 동적 필드 섹션 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-white">추가 정보</label>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    + 필드 추가
                  </button>
                </div>
                <div className="space-y-3">
                  {getCurrentTranslation(editingProject, currentEditLanguage).fields?.map((field, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg" style={{ borderColor: 'var(--fill-white-10)' }}>
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2 items-center">
                          <select
                            value={field.type || 'default'}
                            onChange={(e) => handleFieldChange(index, 'type', e.target.value as 'default' | 'note' | 'note_warning' | 'duration' | 'summary')}
                            className="px-3 py-2 border rounded-lg text-sm bg-transparent text-white"
                            style={{ borderColor: 'var(--fill-white-10)' }}
                          >
                            <option value="default">Default</option>
                            <option value="note">Note</option>
                            <option value="note_warning">Note (Warning)</option>
                            <option value="duration">Duration</option>
                            <option value="summary">Summary</option>
                          </select>
                          {(field.type || 'default') === 'default' && (
                            <>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                                placeholder="제목 (예: Company, Duration, Scope, Team, Key Result, Academic Validation)"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-transparent text-white"
                                style={{ borderColor: 'var(--fill-white-10)' }}
                              />
                              {!field.label?.trim() && (
                                <p className="text-xs text-red-300">Default 타입은 제목이 필요합니다.</p>
                              )}
                            </>
                          )}
                        </div>
                        {(field.type || 'default') === 'duration' ? (
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            placeholder="기간 (예: 2023.09 ~ 2024.04)"
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent text-white"
                            style={{ borderColor: 'var(--fill-white-10)' }}
                          />
                        ) : (field.type || 'default') === 'summary' ? (
                          <textarea
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            placeholder="프로젝트 요약 (각 항목은 새 줄로 구분, ul 리스트로 표시됩니다)"
                            rows={4}
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent text-white"
                            style={{ borderColor: 'var(--fill-white-10)' }}
                          />
                        ) : (
                          <textarea
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            placeholder={(field.type || 'default') === 'note' || (field.type || 'default') === 'note_warning' ? ((field.type || 'default') === 'note_warning' ? 'Warning 문구 (노란 테두리 박스로 표시)' : 'Note 내용') : '내용'}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent text-white"
                            style={{ borderColor: 'var(--fill-white-10)' }}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(index)}
                        className="px-3 py-2 text-sm text-red-400 hover:bg-red-900 rounded-lg"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                  {!getCurrentTranslation(editingProject, currentEditLanguage).fields?.length && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      추가 정보가 없습니다. &quot;+ 필드 추가&quot; 버튼을 클릭하여 필드를 추가하세요.
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Summary 필드를 삭제했는데 포트폴리오에 같은 글이 보이면, 아래 &quot;프로젝트 내용&quot; 본문에도 있을 수 있습니다. 본문에서 해당 문단을 삭제한 뒤 저장해 주세요.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">썸네일 이미지 (ChatBot에 표시됨)</label>
                <div className="mb-4 p-4 rounded-lg" style={{ 
                  border: '1px solid var(--fill-white-10, rgba(255, 255, 255, 0.10))',
                  background: 'var(--fill-white-4, rgba(255, 255, 255, 0.04))'
                }}>
                  <div className="flex items-center gap-3 mb-3">
                    {editingProject.thumbnail ? (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '8px',
                        backgroundImage: `url(${editingProject.thumbnail})`,
                        backgroundSize: 'cover',
                        backgroundPosition: '50% center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: 'lightgray',
                        flexShrink: 0
                      }} />
                    ) : (
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '10px'
                      }}>
                        No
                      </div>
                    )}
                    <span style={{
                      color: 'var(--text-primary, #FFF)',
                      fontFamily: '"Noto Serif KR", serif',
                      fontSize: '14px',
                      fontStyle: 'normal',
                      fontWeight: 500,
                      lineHeight: '160%'
                    }}>
                      {(() => {
                        const currentTitle = getCurrentTranslation(editingProject, currentEditLanguage).title
                        return currentTitle.includes(' - ') 
                          ? currentTitle.split(' - ').slice(1).join(' - ')
                          : currentTitle
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">이 이미지는 ChatBot 인풋 위에 표시됩니다.</p>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="thumbnail-upload"
                      className="px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-800 text-white text-sm"
                      style={{ 
                        borderColor: 'var(--fill-white-10)',
                        display: 'inline-block'
                      }}
                    >
                      {uploadingImage === 'thumbnail' ? '업로드 중...' : editingProject.thumbnail ? '이미지 변경' : '이미지 업로드'}
                    </label>
                    <input
                      id="thumbnail-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleImageUpload(file, 'thumbnail')
                        }
                      }}
                      disabled={uploadingImage === 'thumbnail'}
                      className="hidden"
                    />
                    {editingProject.thumbnail && (
                      <button
                        onClick={() => {
                          setEditingProject({
                            ...editingProject,
                            thumbnail: undefined
                          })
                        }}
                        className="px-4 py-2 border border-red-500 rounded-lg hover:bg-red-900 text-red-500 text-sm"
                      >
                        이미지 제거
                      </button>
                    )}
                  </div>
                  {editingProject.thumbnail && (
                    <div className="mt-3">
                      <img
                        src={editingProject.thumbnail}
                        alt="Thumbnail Preview"
                        className="max-w-xs h-32 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-white">프로젝트 내용</label>
                <RichTextEditor
                  key={`editor-${editingProject.id}-${currentEditLanguage}`}
                  value={getCurrentTranslation(editingProject, currentEditLanguage).content || ''}
                  getContentRef={editorGetContentRef}
                  onChange={(value) => {
                    editorContentRef.current = value
                    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                    const updatedTranslation: ProjectTranslation = {
                      ...currentTranslation,
                      content: value
                    }
                    currentTranslationRef.current = updatedTranslation
                    setEditingProject(setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation))
                  }}
                  onSave={async (content) => {
                    // content를 현재 언어의 translation에 반영한 후 저장
                    const currentTranslation = getCurrentTranslation(editingProject, currentEditLanguage)
                    const updatedTranslation: ProjectTranslation = {
                      ...currentTranslation,
                      content: content
                    }
                    const updatedProject = setCurrentTranslation(editingProject, currentEditLanguage, updatedTranslation)
                    setEditingProject(updatedProject)
                    editorContentRef.current = content
                    // 약간의 지연 후 저장 (상태 업데이트 보장)
                    await new Promise(resolve => setTimeout(resolve, 0))
                    await handleSave()
                  }}
                  placeholder="프로젝트 내용을 작성하세요..."
                />
                <p className="text-xs text-gray-400 mt-2">
                  💡 툴바를 사용하여 텍스트 포맷팅, 제목, 리스트 등을 추가할 수 있습니다. 마크다운도 지원됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Resume 편집 모드
  if (activeTab === 'resume' && !editingProject) {
    return (
      <div className="min-h-screen p-8" style={{ paddingTop: '80px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Resume 편집</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('projects')}
                  className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white"
                >
                  프로젝트로 돌아가기
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white"
                >
                  로그아웃
                </button>
                <button
                  onClick={handleSaveResume}
                  disabled={isSaving || isInitializing}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : isInitializing ? '업데이트 중...' : '저장'}
                </button>
              </div>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded-lg ${
                message.includes('오류') || message.includes('실패') ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'
              }`}>
                {message}
              </div>
            )}

            {isLoadingResume ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                <p className="mt-4 text-white">로딩 중...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 영어 Resume PDF */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">English Resume PDF</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleResumeUpload('en', file)
                        }
                      }}
                      className="hidden"
                      id="resume-en-upload"
                      disabled={uploadingResume.en}
                    />
                    <label
                      htmlFor="resume-en-upload"
                      className={`px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white cursor-pointer ${
                        uploadingResume.en ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingResume.en ? '업로드 중...' : resumeFiles.en ? '파일 변경' : 'PDF 업로드'}
                    </label>
                    {resumeFiles.en && (
                      <span className="text-sm text-gray-400">
                        현재: <a href={resumeFiles.en} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{resumeFiles.en}</a>
                      </span>
                    )}
                  </div>
                </div>

                {/* 한국어 Resume PDF */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">한국어 Resume PDF</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleResumeUpload('ko', file)
                        }
                      }}
                      className="hidden"
                      id="resume-ko-upload"
                      disabled={uploadingResume.ko}
                    />
                    <label
                      htmlFor="resume-ko-upload"
                      className={`px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white cursor-pointer ${
                        uploadingResume.ko ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingResume.ko ? '업로드 중...' : resumeFiles.ko ? '파일 변경' : 'PDF 업로드'}
                    </label>
                    {resumeFiles.ko && (
                      <span className="text-sm text-gray-400">
                        현재: <a href={resumeFiles.ko} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{resumeFiles.ko}</a>
                      </span>
                    )}
                  </div>
                </div>

                {/* 이탈리아어 Resume PDF */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Italiano Resume PDF</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleResumeUpload('it', file)
                        }
                      }}
                      className="hidden"
                      id="resume-it-upload"
                      disabled={uploadingResume.it}
                    />
                    <label
                      htmlFor="resume-it-upload"
                      className={`px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white cursor-pointer ${
                        uploadingResume.it ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {uploadingResume.it ? '업로드 중...' : resumeFiles.it ? '파일 변경' : 'PDF 업로드'}
                    </label>
                    {resumeFiles.it && (
                      <span className="text-sm text-gray-400">
                        현재: <a href={resumeFiles.it} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{resumeFiles.it}</a>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 목록 보기
  return (
    <div className="min-h-screen p-8" style={{ paddingTop: '80px' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">포트폴리오 관리</h1>
          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-800 text-white"
            >
              로그아웃
            </button>
            <button
              onClick={handleAddNew}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              + 새 프로젝트 추가
            </button>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--fill-white-10)' }}>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'projects'
                ? 'border-b-2 border-white text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            프로젝트
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'resume'
                ? 'border-b-2 border-white text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Resume
          </button>
          <button
            onClick={() => router.push('/admin/analytics')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'analytics'
                ? 'border-b-2 border-white text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.includes('오류') ? 'bg-red-900 text-red-200' : 'bg-green-900 text-green-200'
          }`}>
            {message}
          </div>
        )}

        {activeTab === 'projects' && (
          <>
            <div className="space-y-2">
              {projects.map((project) => {
                const projectTitle = (() => {
                  if (project.translations?.en) return project.translations.en.title
                  if (project.translations?.ko) return project.translations.ko.title
                  if (project.translations?.it) return project.translations.it.title
                  return project.title || '프로젝트'
                })()
                
                const projectFields = project.translations?.en?.fields || project.translations?.ko?.fields || project.translations?.it?.fields || project.fields || []
                const period = projectFields.find(f => 
                  f.label.toLowerCase().includes('기간') || 
                  f.label.toLowerCase().includes('period') ||
                  f.label.toLowerCase().includes('duration')
                )?.value || ''
                
                return (
                  <div 
                    key={project.id} 
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-900 transition-colors" 
                    style={{ borderColor: 'var(--fill-white-10)' }}
                  >
                    {project.thumbnail && (
                      <img
                        src={project.thumbnail}
                        alt={projectTitle}
                        className="w-24 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-white truncate">
                          {formatProjectTitle(projectTitle)}
                        </h2>
                        <div className="flex gap-1 flex-shrink-0">
                          {project.translations ? (
                            <>
                              {project.translations.en && (
                                <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">EN</span>
                              )}
                              {project.translations.ko && (
                                <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">KO</span>
                              )}
                              {project.translations.it && (
                                <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">IT</span>
                              )}
                            </>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300">
                              {(project.language || 'en').toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mb-1">
                        {period && (
                          <p className="text-sm text-gray-400 truncate">
                            {period}
                          </p>
                        )}
                        {project.updatedAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(project.updatedAt).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>
                      {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {project.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="px-2 py-0.5 text-xs rounded bg-gray-800 text-gray-300 border"
                              style={{ borderColor: 'var(--fill-white-10)' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(project)}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {projects.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                프로젝트가 없습니다. 새 프로젝트를 추가해보세요.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
