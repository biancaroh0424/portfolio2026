'use client'

/** 로딩 화면만 보려면 브라우저에서 /loading 으로 접속하세요. */
export default function LoadingPreviewPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 loading-screen-enter"
      style={{ backgroundColor: 'var(--greyscale-800)' }}
    >
      <p
        className="mb-2"
        style={{
          color: 'var(--greyscale-white)',
          fontSize: '80px',
          fontWeight: '700',
          fontFamily: 'GalmuriMono9',
        }}
      >
        <span>Loading</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
    </div>
  )
}
