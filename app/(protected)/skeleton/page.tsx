'use client'

import ProjectListSkeleton from '@/components/ProjectListSkeleton'
import Link from 'next/link'

/** 스켈레톤 미리보기: 주소창에 /skeleton 입력해서 확인 */
export default function SkeletonPreviewPage() {
  return (
    <div className="relative">
      <div className="fixed top-4 left-4 z-50 flex items-center gap-3 rounded-lg bg-greyscale-800/90 px-3 py-2 text-sm text-greyscale-200 shadow-lg">
        <span>스켈레톤 미리보기 (리스트)</span>
        <Link
          href="/skeleton/detail"
          className="text-orange-400 hover:underline"
        >
          상세 스켈레톤 →
        </Link>
      </div>
      <ProjectListSkeleton />
    </div>
  )
}
