import type { Metadata } from 'next'
import { ReactNode, Suspense } from 'react'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import UrlLangSync from '@/components/UrlLangSync'

export const metadata: Metadata = {
  title: 'Youngjoo Roh - Portfolio',
  description: 'Product Designer Portfolio',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="ko">
      <body suppressHydrationWarning={true}>
        <LanguageProvider>
          <Suspense fallback={null}>
            <UrlLangSync />
          </Suspense>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}

