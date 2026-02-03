import type { Metadata } from 'next'
import { ReactNode, Suspense } from 'react'
import './globals.css'
import { LanguageProvider } from '@/contexts/LanguageContext'
import UrlLangSync from '@/components/UrlLangSync'
import MixpanelProvider from '@/components/MixpanelProvider'

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
          <MixpanelProvider />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}

