import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { put, list } from '@vercel/blob'

const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json')
const BLOB_PROJECTS_PATH = 'data/projects.json'

function isBlobStorageEnabled(): boolean {
  return (
    process.env.VERCEL === '1' &&
    typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
    process.env.BLOB_READ_WRITE_TOKEN.length > 0
  )
}

async function readProjects(): Promise<any[]> {
  if (isBlobStorageEnabled()) {
    try {
      const { blobs } = await list({ prefix: 'data/', limit: 10 })
      const blob = blobs.find((b) => b.pathname === BLOB_PROJECTS_PATH) ?? blobs.find((b) => b.pathname?.endsWith?.('projects.json'))
      if (blob?.url) {
        const res = await fetch(blob.url + (blob.url.includes('?') ? '&' : '?') + '_=' + Date.now())
        if (res.ok) {
          const json = await res.json()
          return Array.isArray(json) ? json : []
        }
      }
    } catch (e) {
      console.warn('[DELETE project] Blob read failed:', e)
    }
  }
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeProjects(projects: any[]): Promise<void> {
  if (isBlobStorageEnabled()) {
    await put(BLOB_PROJECTS_PATH, JSON.stringify(projects, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return
  }
  const dir = path.dirname(PROJECTS_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2))
}

// 프로젝트 삭제 (로컬: fs, 프로덕션: Vercel Blob)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id
    const projects = await readProjects()
    const filteredProjects = projects.filter((p: any) => p.id !== projectId)
    if (filteredProjects.length === projects.length) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    await writeProjects(filteredProjects)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}

