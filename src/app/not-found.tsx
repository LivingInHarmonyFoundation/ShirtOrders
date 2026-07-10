/**
 * @file not-found.tsx
 * @description Branded 404 page shown for unmatched routes. Client component so it can
 * use the language context; renders inside the root layout (LanguageProvider available).
 */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useT } from '@/contexts/LanguageContext'

export default function NotFound() {
  const t = useT()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ backgroundColor: '#F5F4F0' }}>
      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-sm p-2">
        <Image src="/logo.png" alt="Living in Harmony Foundation" width={44} height={44} className="object-contain" />
      </div>
      <p className="font-heading font-bold tracking-[0.3em] mb-2" style={{ color: '#CEDC00', fontSize: '13px' }}>404</p>
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">{t('errors', 'pageNotFound')}</h1>
      <p className="text-gray-500 max-w-sm leading-relaxed mb-8">{t('errors', 'pageNotFoundDesc')}</p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
        style={{ backgroundColor: '#00352F' }}
      >
        ← {t('common', 'backToHome')}
      </Link>
    </div>
  )
}
