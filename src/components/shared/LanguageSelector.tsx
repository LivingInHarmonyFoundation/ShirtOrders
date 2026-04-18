'use client'

import { useLanguage } from '@/contexts/LanguageContext'

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
