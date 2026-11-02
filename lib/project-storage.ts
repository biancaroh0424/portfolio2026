import fs from 'fs/promises'
import path from 'path'
import { list, put } from '@vercel/blob'
import { isPublicProject, visibleProjects } from './project-visibility'
import { decryptPrivateContent, encryptPrivateContent } from './private-content'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')
const BLOB_PROJECTS_PATH = 'data/projects.json'
type StoredProject = Record<string, any>

export function usesBlobStorage(): boolean {
  return process.env.VERCEL === '1' && Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function encodeStoredProjects(projects: StoredProject[]): StoredProject[] {
  return projects.map(project => isPublicProject(project) ? project : {
    storageFormat: 'private-project-v1',
    encrypted: encryptPrivateContent(Buffer.from(JSON.stringify(project))).toString('base64'),
  })
}

export function decodeStoredProjects(projects: StoredProject[], includePrivate = false): StoredProject[] {
  const decoded = projects.flatMap(project => {
    if (project.storageFormat !== 'private-project-v1') return [project]
    if (!includePrivate) return []
    const value = JSON.parse(decryptPrivateContent(Buffer.from(project.encrypted, 'base64')).toString('utf8'))
    // An encrypted record must never become public due to corrupt metadata.
    return [{ ...value, visibility: 'private' }]
  })
  return visibleProjects(decoded, includePrivate)
}

/** Fresh reads prevent a visibility change from being defeated by an old cache. */
export async function readStoredProjects(includePrivate = false): Promise<StoredProject[]> {
  if (usesBlobStorage()) {
    const { blobs } = await list({ prefix: 'data/', limit: 1000 })
    const blob = blobs.find(item => item.pathname === BLOB_PROJECTS_PATH)
      ?? blobs.find(item => item.pathname === `/${BLOB_PROJECTS_PATH}`)
      ?? blobs.find(item => item.pathname.endsWith('/projects.json'))
    if (!blob) return []
    const response = await fetch(`${blob.url}?_=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('프로젝트 저장소를 읽지 못했습니다.')
    const json = await response.json()
    if (!Array.isArray(json)) throw new Error('Invalid project data')
    return decodeStoredProjects(json, includePrivate)
  }
  try {
    const json = JSON.parse(await fs.readFile(PROJECTS_FILE, 'utf8'))
    if (!Array.isArray(json)) throw new Error('Invalid project data')
    return decodeStoredProjects(json, includePrivate)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

export async function writeStoredProjects(projects: StoredProject[]): Promise<void> {
  if (usesBlobStorage()) {
    await put(BLOB_PROJECTS_PATH, JSON.stringify(encodeStoredProjects(projects)), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
      allowOverwrite: true, cacheControlMaxAge: 60,
    })
    return
  }
  await fs.mkdir(path.dirname(PROJECTS_FILE), { recursive: true })
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))
}
