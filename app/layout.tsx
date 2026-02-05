import type { Metadata } from 'next'
import { ReactNode, Suspense } from 'react'
import Script from 'next/script'
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
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "vcpvftb3hw");
            `,
          }}
        />
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

