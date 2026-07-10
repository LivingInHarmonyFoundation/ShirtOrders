/**
 * @file InstitutionTypePicker.tsx
 * @description Shared "Order Type" selector — the 5-option institution-type picker
 * (school / government / personal / private company / staff) used by the full
 * multi-institution order forms. Owns the option list (built from settings' per-type
 * enabled flags) so it isn't duplicated per page. Markup/styling preserved exactly.
 */
'use client'

import { School, Building2, User, Briefcase, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import type { AppSettings, InstitutionType } from '@/types'

interface InstitutionTypePickerProps {
  stepNumber: string
  settings: AppSettings | null
  selectedType: InstitutionType | ''
  onSelect: (type: InstitutionType) => void
  error?: string
}

export default function InstitutionTypePicker({
  stepNumber,
  settings,
  selectedType,
  onSelect,
  error,
}: InstitutionTypePickerProps) {
  const t = useT()

  const institutionOptions = [
    { value: 'school' as const,          labelKey: 'school' as const,         icon: School,    enabled: settings?.school_orders_enabled !== false },
    { value: 'government' as const,      labelKey: 'government' as const,     icon: Building2, enabled: settings?.government_orders_enabled !== false },
    { value: 'personal' as const,        labelKey: 'personal' as const,       icon: User,      enabled: settings?.personal_orders_enabled !== false },
    { value: 'private_company' as const, labelKey: 'privateCompany' as const, icon: Briefcase, enabled: settings?.private_company_orders_enabled !== false },
    { value: 'staff' as const,           labelKey: 'staff' as const,          icon: Users,     enabled: settings?.staff_orders_enabled === true },
  ]

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
            style={{ backgroundColor: '#00352F' }}
          >
            {stepNumber}
          </div>
          <div>
            <CardTitle className="text-base">{t('order', 'orderType')}</CardTitle>
            <CardDescription className="mt-0.5">{t('order', 'orderTypeSub')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('order', 'orderType')}>
          {institutionOptions.filter(o => o.enabled).map(({ value, labelKey, icon: Icon }) => {
            const active = selectedType === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onSelect(value)}
                className={cn(
                  'relative flex flex-col items-center gap-3 py-5 px-3 rounded-2xl border-2 transition-all duration-150 overflow-hidden',
                  active
                    ? 'border-[#00352F] bg-[#E5F2F0] shadow-md'
                    : 'border-gray-200 bg-white hover:border-[#CEDC00]/50 hover:bg-[#F9FCF7]'
                )}
              >
                {active && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[3px]"
                    style={{ backgroundColor: '#00352F' }}
                  />
                )}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                  style={{ backgroundColor: active ? 'rgba(0,53,47,0.12)' : '#F3F4F6' }}
                >
                  <Icon className="w-5 h-5" style={{ color: active ? '#00352F' : '#6B7280' }} />
                </div>
                <span
                  className="text-xs font-semibold leading-none"
                  style={{ color: active ? '#00352F' : '#374151' }}
                >
                  {t('order', labelKey)}
                </span>
              </button>
            )
          })}
        </div>
        {error && (
          <p role="alert" className="text-red-600 text-xs mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
