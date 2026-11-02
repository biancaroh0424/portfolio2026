import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'
import { getProject } from '@/lib/data'
import { hasAdminSession } from '@/lib/admin-auth'
import { isPublicProject } from '@/lib/project-visibility'

export const dynamic = 'force-dynamic'

const getVisibleProject = cache(async (id: string) => {
  const project = await getProject(id, hasAdminSession())
  if (!project) notFound()
  return project
})

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const project = await getVisibleProject(params.id)
  return isPublicProject(project) ? {} : { robots: { index: false, follow: false } }
}

export default async function ProjectLayout({ children, params }: {
  children: React.ReactNode
  params: { id: string }
}) {
  const project = await getVisibleProject(params.id)
  if (!isPublicProject(project)) return (
    <div data-private-project="true" data-clarity-mask="true" className="mp-sensitive">
      <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-gray-600 bg-gray-900 px-4 py-2 text-sm text-gray-200 shadow-lg">
        비공개 문서 · 관리자 미리보기
      </div>
      {children}
    </div>
  )
  return children
}
