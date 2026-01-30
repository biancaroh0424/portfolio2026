import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'var(--greyscale-800)' }}
    >
      <p
        className="mb-2"
        style={{ color: 'var(--greyscale-white)', fontSize: '120px', fontWeight: '700',
          fontFamily: 'GalmuriMono9',
         }}
      >
        404
      </p>
      <p
        className="text-title-4-regular mb-6 text-center"
        style={{ color: 'var(--greyscale-200)',
          fontSize: '24px', fontWeight: '700',
          fontFamily: 'GalmuriMono9',
         }}
      >
        페이지를 찾을 수 없어요.
      </p>
      <p
        className="text-paragraph mb-10 text-center max-w-md"
        style={{ color: 'var(--greyscale-300)' }}
      >
        주소가 잘못되었거나 페이지가 이동·삭제되었을 수 있습니다.
      </p>
      <Link
        href="/home"
        className="text-link-underlined inline-block"
        style={{
          color: 'var(--greyscale-white)',
          textDecorationColor: 'var(--orange-400)',
        }}
      >
        홈으로 돌아가기
      </Link>
    </div>
  )
}
