'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.push('/home')
  }, [router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 loading-screen-enter"
      style={{ backgroundColor: 'var(--greyscale-800)' }}
    >
      <p
        className="mb-2"
        style={{
          color: 'var(--greyscale-white)',
          fontSize: '120px',
          fontWeight: '700',
          fontFamily: 'GalmuriMono9',
        }}
      >
        <span>Loading</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
      <p
        className="text-title-4-regular mb-6 text-center"
        style={{
          color: 'var(--greyscale-200)',
          fontSize: '24px',
          fontWeight: '700',
          fontFamily: 'GalmuriMono9',
        }}
      >
        잠시만 기다려 주세요.
      </p>
      <p
        className="text-paragraph text-center max-w-md"
        style={{ color: 'var(--greyscale-300)' }}
      >
        홈으로 이동 중입니다.
      </p>
    </div>
  )
}
