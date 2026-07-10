/**
 * @file error.tsx
 * @description Branded error boundary for the app. Must be a Client Component (App Router
 * requirement). Catches render/runtime errors in the route subtree and offers a reset,
 * plus a link home. Renders inside the root layout, so the language context is available.
 */
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useT } from '@/contexts/LanguageContext'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT()

  useEffect(() => {
    // Surface the error for logging/observability.
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F5F4F0' }}>
      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm p-2">
        <Image src="/logo.png" alt="Living in Harmony Foundation" width={44} height={44} className="object-contain" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">{t('errors', 'errorTitle')}</h1>
      <p className="text-gray-500 max-w-sm leading-relaxed mb-8">{t('errors', 'errorDesc')}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: '#00352F' }}
        >
          {t('common', 'tryAgain')}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-white"
          style={{ borderColor: 'rgba(0,53,47,0.2)', color: '#00352F' }}
        >
          {t('common', 'backToHome')}
        </Link>
      </div>
    </div>
  )
}
