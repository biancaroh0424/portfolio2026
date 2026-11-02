import { isAdminRequest, requireAdmin } from '@/lib/admin-auth'
import { NextRequest, NextResponse } from 'next/server'
import { readStoredProjects, writeStoredProjects } from '@/lib/project-storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const projects = await readStoredProjects(isAdminRequest(request))
    const project = projects.find(project => project.id === params.id)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    return NextResponse.json(project, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  } catch (error) {
    console.error('Error reading project:', error)
    return NextResponse.json({ error: 'Failed to read project' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authError = requireAdmin(request)
  if (authError) return authError
  try {
    const projects = await readStoredProjects(true)
    const remaining = projects.filter(project => project.id !== params.id)
    if (remaining.length === projects.length) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    await writeStoredProjects(remaining)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
