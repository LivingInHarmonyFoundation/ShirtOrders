/**
 * @file LanguageSelector.tsx
 * @description Pill-style EN / ES language toggle backed by LanguageContext.
 * Active locale is highlighted with the brand dark-green background and lime text.
 * Used in public-facing headers (order form, confirmation page).
 */
'use client'

import { useLanguage } from '@/contexts/LanguageContext'

/**
 * LanguageSelector — two-button pill toggle that switches between 'en' and 'es'
 * via LanguageContext.setLang. Renders flag emoji + locale code.
 */
/**
 * variant "light" (default) — for light/white backgrounds (public pages, login).
 * variant "dark" — for dark backgrounds (admin sidebar).
 */
export default function LanguageSelector({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { lang, setLang } = useLanguage()

  const borderColor = variant === 'dark' ? 'rgba(206,220,0,0.25)' : 'rgba(0,53,47,0.2)'

  const activeStyle = variant === 'dark'
    ? { backgroundColor: 'rgba(206,220,0,0.15)', color: '#CEDC00' }
    : { backgroundColor: '#00352F', color: '#CEDC00' }

  const inactiveStyle = variant === 'dark'
    ? { backgroundColor: 'transparent', color: 'rgba(209,250,229,0.4)' }
    : { backgroundColor: 'transparent', color: '#6b7280' }

  return (
    <div
      className="flex items-center rounded-full border overflow-hidden text-xs font-semibold select-none"
      style={{ borderColor }}
    >
      {(['en', 'es'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="px-2.5 py-1 transition-colors"
          style={lang === l ? activeStyle : inactiveStyle}
          aria-pressed={lang === l}
        >
          {l === 'en' ? 'EN' : 'ES'}
        </button>
      ))}
    </div>
  )
}
