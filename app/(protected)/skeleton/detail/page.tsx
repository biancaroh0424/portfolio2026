'use client'

import ProjectDetailSkeleton from '@/components/ProjectDetailSkeleton'
import Link from 'next/link'

/** 스켈레톤 미리보기: 주소창에 /skeleton/detail 입력해서 확인 */
export default function SkeletonDetailPreviewPage() {
  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3 rounded-lg bg-greyscale-800/90 px-3 py-2 text-sm text-greyscale-200 shadow-lg">
        <span>스켈레톤 미리보기 (상세)</span>
        <Link href="/skeleton" className="text-orange-400 hover:underline">
          ← 리스트 스켈레톤
        </Link>
      </div>
      <ProjectDetailSkeleton />
    </div>
  )
}
