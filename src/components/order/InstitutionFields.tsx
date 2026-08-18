/**
 * @file InstitutionFields.tsx
 * @description Shared conditional institution field blocks (school / government /
 * private company / personal delivery) for the full multi-institution order forms.
 * Renders the block matching `institutionType`. Extracted from the duplicated main +
 * campaign order pages; markup and styling preserved exactly.
 *
 * Typed against the shared OrderFormData so register/errors/setValue stay type-safe.
 */
'use client'

import { useState } from 'react'
import type { UseFormRegister, FieldErrors, UseFormSetValue } from 'react-hook-form'
import { School, Briefcase, Check, ChevronsUpDown, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import type { InstitutionType, GovOrg, PrivateCompany, Municipality } from '@/types'
import type { OrderFormData } from './orderFormSchema'

interface InstitutionFieldsProps {
  institutionType: InstitutionType | ''
  /** Step badge number for the field card (String(baseStep + 2)). */
  stepNumber: string
  register: UseFormRegister<OrderFormData>
  errors: FieldErrors<OrderFormData>
  setValue: UseFormSetValue<OrderFormData>
  govOrgs: GovOrg[]
  selectedGovOrg: GovOrg | null
  /** Called when a government org is picked — updates selection + dependent department. */
  onGovOrgChange: (name: string) => void
  /** Currently selected department (drives the optional region dropdown). */
  selectedDepartment?: string
  /** Called when the department changes — updates the field and resets the region. */
  onDepartmentChange?: (dept: string) => void
  privateCompanies: PrivateCompany[]
  /** Municipios shown in the dropdown for the "municipality" order type. */
  municipalities?: Municipality[]
  /** Currently selected municipio (watch('organization_name')) for the combobox display. */
  selectedMunicipality?: string
  /** Campaign-link flow: when set, the school name is pre-filled and shown read-only. */
  lockedSchoolName?: string | null
  /** Campaign-link flow: when set, the company name is pre-filled and shown read-only. */
  lockedCompanyName?: string | null
}

/** Read-only pre-filled entity chip (school/company link flow). */
function PrefilledEntity({ icon: Icon, name, label }: { icon: typeof School; name: string; label: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-[#E5F2F0] border border-[#CEDC00]/30 rounded-lg">
      <Icon className="w-4 h-4 text-[#00352F] flex-shrink-0" />
      <span className="text-sm text-[#00352F] font-semibold">{name}</span>
      <span className="ml-auto text-xs text-[#00352F]/50 bg-[#CEDC00]/20 px-2 py-0.5 rounded">{label}</span>
    </div>
  )
}

const NATIVE_SELECT_CLASS =
  'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'

/**
 * MunicipalityCombobox — searchable picker for the 78 municipios. A plain native
 * select is unwieldy at that size (a huge list that can open upward), so this uses
 * a Popover + Command combobox: tap to open a panel anchored below the field with a
 * search box and a scrollable, filtered list. Works well on desktop and mobile.
 */
function MunicipalityCombobox({
  municipalities, value, onSelect, invalid,
}: {
  municipalities: Municipality[]
  value: string
  onSelect: (name: string) => void
  invalid?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-invalid={invalid}
        className={cn(
          'mt-1 w-full flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm text-left',
          'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors',
          invalid ? 'border-red-300' : 'border-input hover:border-[#00352F]/30',
        )}
      >
        <MapPin className="w-4 h-4 text-[#00352F]/50 flex-shrink-0" />
        <span className={cn('flex-1 truncate', value ? 'font-medium text-gray-900' : 'text-gray-400')}>
          {value || t('order', 'selectMunicipality')}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--anchor-width)]"
        align="start"
        side="bottom"
        sideOffset={4}
        // Fixed positioning: the popup is viewport-anchored from its first frame,
        // so nothing inside it (cmdk auto-scrolling its selected item into view)
        // can yank the page scroll to the top while the popup is being placed.
        positionMethod="fixed"
        // Don't move focus into the popup on open: the popup grabs focus before
        // it's positioned, which makes the browser scroll the page to the top
        // (reported by real customers on step 3). Users tap the search box if
        // they want to type; on phones this also keeps the keyboard closed so
        // the list stays visible.
        initialFocus={false}
      >
        <Command>
          <CommandInput placeholder={t('order', 'searchMunicipality')} />
          <CommandList className="max-h-56 overscroll-contain">
            <CommandEmpty>{t('order', 'noMunicipalityFound')}</CommandEmpty>
            {municipalities.map(m => (
              <CommandItem
                key={m.id}
                value={m.name}
                onSelect={() => { onSelect(m.name); setOpen(false) }}
                className="py-2.5"
              >
                <Check className={cn('w-4 h-4 mr-1 text-[#00352F]', value === m.name ? 'opacity-100' : 'opacity-0')} />
                {m.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const StepBadge = ({ n }: { n: string }) => (
  <div
    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
    style={{ backgroundColor: '#00352F' }}
  >
    {n}
  </div>
)

export default function InstitutionFields({
  institutionType,
  stepNumber,
  register,
  errors,
  setValue,
  govOrgs,
  selectedGovOrg,
  onGovOrgChange,
  selectedDepartment,
  onDepartmentChange,
  privateCompanies,
  municipalities = [],
  selectedMunicipality = '',
  lockedSchoolName,
  lockedCompanyName,
}: InstitutionFieldsProps) {
  const t = useT()

  if (institutionType === 'municipality') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <StepBadge n={stepNumber} />
            <CardTitle className="text-base">{t('order', 'municipalityInfo')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('order', 'municipalityName')} *</Label>
            {municipalities.length > 0 ? (
              <>
                {/* Hidden registered field keeps organization_name in the form state;
                    the combobox writes to it via setValue. */}
                <input type="hidden" {...register('organization_name')} />
                <MunicipalityCombobox
                  municipalities={municipalities}
                  value={selectedMunicipality}
                  onSelect={name => setValue('organization_name', name, { shouldValidate: true })}
                  invalid={!!errors.organization_name}
                />
              </>
            ) : (
              <Input id="organization_name" {...register('organization_name')} aria-invalid={!!errors.organization_name} placeholder={t('order', 'municipalityName')} className="mt-1" />
            )}
            {errors.organization_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.organization_name.message}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (institutionType === 'school') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <StepBadge n={stepNumber} />
            <CardTitle className="text-base">{t('order', 'schoolInfo')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="school_name">{t('order', 'schoolName')} *</Label>
            {lockedSchoolName ? (
              <PrefilledEntity icon={School} name={lockedSchoolName} label={t('order', 'preFilledLabel')} />
            ) : (
              <>
                <Input id="school_name" {...register('school_name')} aria-invalid={!!errors.school_name} placeholder={t('order', 'schoolNamePlaceholder')} className="mt-1" />
                {errors.school_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.school_name.message}</p>}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grade">{t('order', 'gradeGroup')} *</Label>
              <Input id="grade" {...register('grade')} aria-invalid={!!errors.grade} placeholder={t('order', 'gradeGroupPlaceholder')} className="mt-1" />
              {errors.grade && <p role="alert" className="text-red-600 text-xs mt-1">{errors.grade.message}</p>}
            </div>
            <div>
              <Label htmlFor="classroom">{t('order', 'classroom')} *</Label>
              <Input id="classroom" {...register('classroom')} aria-invalid={!!errors.classroom} placeholder={t('order', 'classroomPlaceholder')} className="mt-1" />
              {errors.classroom && <p role="alert" className="text-red-600 text-xs mt-1">{errors.classroom.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (institutionType === 'government') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <StepBadge n={stepNumber} />
            <CardTitle className="text-base">{t('order', 'orgInfo')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="organization_name">{t('order', 'orgName')} *</Label>
            {govOrgs.length > 0 ? (
              <select
                id="organization_name"
                {...register('organization_name')}
                aria-invalid={!!errors.organization_name}
                onChange={e => onGovOrgChange(e.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">{t('order', 'selectOrg')}</option>
                {govOrgs.map(org => (
                  <option key={org.id} value={org.name}>{org.name}</option>
                ))}
              </select>
            ) : (
              <Input id="organization_name" {...register('organization_name')} aria-invalid={!!errors.organization_name} placeholder={t('order', 'govOrgInputPlaceholder')} className="mt-1" />
            )}
            {errors.organization_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.organization_name.message}</p>}
          </div>
          <div>
            <Label htmlFor="department_office">{t('order', 'deptOffice')} *</Label>
            {selectedGovOrg?.departments && selectedGovOrg.departments.length > 0 ? (
              <select
                id="department_office"
                {...register('department_office')}
                aria-invalid={!!errors.department_office}
                onChange={e => onDepartmentChange?.(e.target.value)}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">{t('order', 'selectDept')}</option>
                {selectedGovOrg.departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            ) : (
              <Input id="department_office" {...register('department_office')} aria-invalid={!!errors.department_office} placeholder={t('order', 'deptPlaceholder')} className="mt-1" />
            )}
            {errors.department_office && <p role="alert" className="text-red-600 text-xs mt-1">{errors.department_office.message}</p>}
          </div>

          {/* Region — shown only when the selected department defines regions (then required) */}
          {(() => {
            const regions = selectedDepartment ? (selectedGovOrg?.department_regions?.[selectedDepartment] || []) : []
            if (regions.length === 0) return null
            return (
              <div>
                <Label htmlFor="region">{t('order', 'region')} *</Label>
                <select
                  id="region"
                  {...register('region')}
                  aria-invalid={!!errors.region}
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="">{t('order', 'selectRegion')}</option>
                  {regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.region && <p role="alert" className="text-red-600 text-xs mt-1">{errors.region.message}</p>}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    )
  }

  if (institutionType === 'private_company') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <StepBadge n={stepNumber} />
            <CardTitle className="text-base">{t('order', 'companyInfo')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="company_name">{t('order', 'companyName')} *</Label>
            {lockedCompanyName ? (
              <PrefilledEntity icon={Briefcase} name={lockedCompanyName} label={t('order', 'preFilledLabel')} />
            ) : privateCompanies.length > 0 ? (
              <select
                id="company_name"
                {...register('company_name')}
                aria-invalid={!!errors.company_name}
                className={NATIVE_SELECT_CLASS}
              >
                <option value="">{t('order', 'selectCompany')}</option>
                {privateCompanies.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            ) : (
              <Input id="company_name" {...register('company_name')} aria-invalid={!!errors.company_name} placeholder={t('order', 'companyInputPlaceholder')} className="mt-1" />
            )}
            {!lockedCompanyName && errors.company_name && <p role="alert" className="text-red-600 text-xs mt-1">{errors.company_name.message}</p>}
          </div>
          <div>
            <Label htmlFor="company_department">{t('order', 'companyDept')} <span className="text-gray-400">{t('common', 'optional')}</span></Label>
            <Input id="company_department" {...register('company_department')} aria-invalid={!!errors.company_department} placeholder={t('order', 'companyDeptPlaceholder')} className="mt-1" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (institutionType === 'personal') {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <StepBadge n={stepNumber} />
            <div>
              <CardTitle className="text-base">{t('order', 'deliveryInfo')}</CardTitle>
              <CardDescription className="mt-0.5">{t('order', 'deliveryInfoSub')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="delivery_street">{t('order', 'streetAddress')} *</Label>
            <Input id="delivery_street" {...register('delivery_street')} aria-invalid={!!errors.delivery_street} placeholder={t('order', 'streetAddressPlaceholder')} className="mt-1" />
            {errors.delivery_street && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_street.message}</p>}
          </div>
          <div>
            <Label htmlFor="delivery_street2">{t('order', 'streetAddress2')}</Label>
            <Input id="delivery_street2" {...register('delivery_street2')} placeholder={t('order', 'streetAddress2Placeholder')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delivery_city">{t('order', 'city')} *</Label>
              <Input id="delivery_city" {...register('delivery_city')} aria-invalid={!!errors.delivery_city} placeholder={t('order', 'cityPlaceholder')} className="mt-1" />
              {errors.delivery_city && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_city.message}</p>}
            </div>
            <div>
              <Label htmlFor="delivery_state">{t('order', 'state')} *</Label>
              <Input id="delivery_state" {...register('delivery_state')} aria-invalid={!!errors.delivery_state} placeholder={t('order', 'statePlaceholder')} className="mt-1" />
              {errors.delivery_state && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_state.message}</p>}
            </div>
          </div>
          <div className="max-w-[160px]">
            <Label htmlFor="delivery_zip">{t('order', 'zipCode')} *</Label>
            <Input id="delivery_zip" {...register('delivery_zip')} aria-invalid={!!errors.delivery_zip} placeholder={t('order', 'zipPlaceholder')} className="mt-1" />
            {errors.delivery_zip && <p role="alert" className="text-red-600 text-xs mt-1">{errors.delivery_zip.message}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
