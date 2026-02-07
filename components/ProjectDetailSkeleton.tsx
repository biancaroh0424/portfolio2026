'use client'

/** 포트폴리오 상세 로딩 스켈레톤. /skeleton/detail 에서 미리보기 가능 */
export default function ProjectDetailSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="flex flex-col tablet:flex-row">
        <div className="hidden tablet:block sticky top-[80px] left-0 z-30 self-start w-[200px] tablet:w-[260px] px-4 max-h-[calc(100vh-80px)]">
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded animate-pulse w-[60%]" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-[80%] ml-4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-[70%] ml-4" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-[90%] ml-6" />
            <div className="h-3 bg-gray-700 rounded animate-pulse w-[75%] ml-6" />
          </div>
        </div>

        <div className="flex-1 w-full max-w-[980px] mx-auto px-4 tablet:px-6 pt-12 tablet:pt-16 desktop:pt-20 pb-12 tablet:pb-16 desktop:pb-20">
          <div className="space-y-4 tablet:space-y-6">
            <div className="w-full aspect-[9/4] h-36 tablet:h-48 desktop:h-64 bg-gray-700 rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 tablet:h-7 desktop:h-8 bg-gray-700 rounded animate-pulse w-3/5 max-w-[320px]" />
              <div className="h-6 tablet:h-7 desktop:h-8 bg-gray-700 rounded animate-pulse w-2/5 max-w-[200px]" />
            </div>
            <div className="space-y-2">
              <div className="h-5 tablet:h-6 bg-gray-700 rounded animate-pulse w-2/5" />
              <div className="space-y-2">
                <div className="h-10 tablet:h-12 desktop:h-16 bg-gray-700 rounded animate-pulse" />
                <div className="h-10 tablet:h-12 desktop:h-16 bg-gray-700 rounded animate-pulse" />
                <div className="h-10 tablet:h-12 desktop:h-16 bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-3 tablet:space-y-4">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-700 rounded animate-pulse w-[95%]" />
              <div className="h-4 bg-gray-700 rounded animate-pulse w-[90%]" />
              <div className="h-36 tablet:h-48 desktop:h-64 bg-gray-700 rounded-lg animate-pulse w-full" />
              <div className="h-4 bg-gray-700 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-700 rounded animate-pulse w-[85%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
