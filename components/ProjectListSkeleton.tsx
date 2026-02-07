'use client'

/** 포트폴리오 리스트 로딩 스켈레톤. /skeleton 에서 미리보기 가능 */
export default function ProjectListSkeleton() {
  const skeletonBg = 'rgba(255, 255, 255, 0.1)'
  const borderGradient =
    'linear-gradient(to right, var(--greyscale-700, #222424), var(--greyscale-200, #b3b3b3), var(--greyscale-700, #222424))'

  return (
    <div className="min-h-screen projects-page">
      <div className="flex flex-col items-center self-stretch pt-[200px] pb-[200px]">
        <div className="flex flex-col gap-4 self-stretch w-full max-w-[1160px] mx-auto px-4 tablet:px-6">
          <div
            className="animate-pulse rounded h-9 tablet:h-12 desktop:h-[67px] w-32 tablet:w-40 desktop:w-[200px]"
            style={{ backgroundColor: skeletonBg }}
          />
        </div>

        <div className="flex flex-col justify-center items-start self-stretch pt-8 tablet:pt-12 desktop:pt-[49px]">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse flex flex-col tablet:flex-row justify-center items-center gap-4 tablet:gap-6 self-stretch w-full relative px-4 tablet:px-6"
            >
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: borderGradient }} />
              <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: borderGradient }} />
              <div className="flex flex-col tablet:flex-row flex-1 w-full min-w-0 max-w-[1160px] justify-center items-center flex-wrap border-x border-[#46474A] gap-4 tablet:gap-6 py-4 tablet:py-6">
                <div className="flex flex-col gap-4 tablet:gap-6 flex-1 min-w-0 w-full tablet:min-w-[356px] px-4 tablet:px-6 pt-4 tablet:pt-6 pb-4 order-2 tablet:order-1">
                  <div className="h-3.5 w-20 tablet:w-24 rounded" style={{ backgroundColor: skeletonBg }} />
                  <div className="h-6 tablet:h-8 desktop:h-[34px] w-4/5 max-w-[280px] rounded" style={{ backgroundColor: skeletonBg }} />
                  <div className="flex flex-col gap-2">
                    <div className="h-5 w-full rounded" style={{ backgroundColor: skeletonBg }} />
                    <div className="h-5 w-[90%] rounded" style={{ backgroundColor: skeletonBg }} />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-6 w-14 tablet:w-[60px] rounded" style={{ backgroundColor: skeletonBg }} />
                    <div className="h-6 w-16 tablet:w-20 rounded" style={{ backgroundColor: skeletonBg }} />
                  </div>
                </div>
                <div className="flex flex-col justify-center items-center w-full tablet:w-[412px] tablet:min-w-[412px] h-[180px] tablet:h-[220px] desktop:h-[260px] px-4 order-1 tablet:order-2">
                  <div className="w-full h-full rounded" style={{ backgroundColor: skeletonBg }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
