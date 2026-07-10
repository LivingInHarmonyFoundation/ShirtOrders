/**
 * @file PersonalInfoCard.tsx
 * @description Shared "Personal Information" section (full name / email / phone) used by
 * the order forms. Extracted from the duplicated order pages so the fields, validation
 * display, and i18n live in one place.
 *
 * Type-safe by design: the parent passes the already-registered react-hook-form fields
 * (UseFormRegisterReturn) plus error messages, so this component needs no knowledge of the
 * parent's full form schema. Phone uses an onChange override for live formatting.
 */
'use client'

import type { UseFormRegisterReturn } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/contexts/LanguageContext'

interface PersonalInfoCardProps {
  /** Step number shown in the card's badge (the forms number their cards). */
  stepNumber: string
  fullNameReg: UseFormRegisterReturn
  emailReg: UseFormRegisterReturn
  phoneReg: UseFormRegisterReturn
  /** Live phone formatting — receives the raw input value. */
  onPhoneChange: (value: string) => void
  fullNameError?: string
  emailError?: string
  phoneError?: string
}

export default function PersonalInfoCard({
  stepNumber,
  fullNameReg,
  emailReg,
  phoneReg,
  onPhoneChange,
  fullNameError,
  emailError,
  phoneError,
}: PersonalInfoCardProps) {
  const t = useT()
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
          <CardTitle className="text-base">{t('order', 'personalInfo')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="full_name">{t('order', 'fullName')} *</Label>
          <Input id="full_name" {...fullNameReg} aria-invalid={!!fullNameError} placeholder={t('order', 'fullNamePlaceholder')} className="mt-1" />
          {fullNameError && <p role="alert" className="text-red-600 text-xs mt-1">{fullNameError}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">{t('order', 'emailAddress')} *</Label>
            <Input id="email" type="email" {...emailReg} aria-invalid={!!emailError} placeholder={t('order', 'emailPlaceholder')} className="mt-1" />
            {emailError && <p role="alert" className="text-red-600 text-xs mt-1">{emailError}</p>}
          </div>
          <div>
            <Label htmlFor="phone">{t('order', 'phone')} <span className="text-gray-400">{t('common', 'optional')}</span></Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              {...phoneReg}
              onChange={e => onPhoneChange(e.target.value)}
              placeholder="(787) 555 - 1234"
              maxLength={16}
              className="mt-1"
            />
            {phoneError && <p role="alert" className="text-red-600 text-xs mt-1">{phoneError}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
