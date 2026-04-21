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
export default function LanguageSelector() {
  const { lang, setLang } = useLanguage()

  return (
    <div
      className="flex items-center rounded-full border overflow-hidden text-xs font-semibold select-none"
      style={{ borderColor: 'rgba(0,53,47,0.2)' }}
    >
      {(['en', 'es'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className="px-2.5 py-1 transition-colors"
          style={lang === l
            ? { backgroundColor: '#00352F', color: '#CEDC00' }
            : { backgroundColor: 'transparent', color: '#6b7280' }
          }
          aria-pressed={lang === l}
        >
          {l === 'en' ? '🇺🇸 EN' : '🇵🇷 ES'}
        </button>
      ))}
    </div>
  )
}
