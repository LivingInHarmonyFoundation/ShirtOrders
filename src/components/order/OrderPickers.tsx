/**
 * @file OrderPickers.tsx
 * @description Shared multi-select pickers for the order forms: CampaignPicker (shown when
 * more than one campaign is active) and CatalogPicker (shown when more than one shirt style
 * exists). Extracted from the duplicated main + campaign order pages; markup preserved exactly.
 */
'use client'

import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import ShirtViewer from '@/components/shared/ShirtViewer'
import { cn } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import type { Campaign, ShirtCatalogItem } from '@/types'

const StepBadge = ({ n }: { n: string }) => (
  <div
    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold font-heading flex-shrink-0"
    style={{ backgroundColor: '#00352F' }}
  >
    {n}
  </div>
)

interface CampaignPickerProps {
  stepNumber: string
  campaigns: Campaign[]
  selectedCampaign: Campaign | null
  onSelect: (campaign: Campaign) => void
}

export function CampaignPicker({ stepNumber, campaigns, selectedCampaign, onSelect }: CampaignPickerProps) {
  const t = useT()
  return (
    <Card className={cn('border-2 shadow-sm transition-colors', !selectedCampaign ? 'border-amber-300 bg-amber-50/60' : 'border-[#CEDC00]/40')}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <StepBadge n={stepNumber} />
          <div>
            <CardTitle className="text-base">{t('order', 'selectCampaign')} *</CardTitle>
            <CardDescription className="mt-0.5">{t('order', 'selectCampaignSub')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {campaigns.map(campaign => {
            const isSelected = selectedCampaign?.id === campaign.id
            return (
              <button
                key={campaign.id}
                type="button"
                onClick={() => onSelect(campaign)}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all focus:outline-none',
                  isSelected
                    ? 'border-[#00352F] bg-[#E5F2F0] shadow-sm'
                    : 'border-gray-200 bg-white hover:border-[#00352F]/40'
                )}
              >
                <div className={cn(
                  'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  isSelected ? 'border-[#00352F] bg-[#00352F]' : 'border-gray-300 bg-white'
                )}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <p className={cn('font-semibold text-sm leading-tight', isSelected ? 'text-[#00352F]' : 'text-gray-900')}>
                    {campaign.name}
                  </p>
                  {campaign.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-snug">{campaign.description}</p>
                  )}
                  {(campaign.start_date || campaign.end_date) && (
                    <p className="text-xs mt-1.5" style={{ color: isSelected ? '#00352F' : '#9CA3AF' }}>
                      {campaign.start_date && campaign.end_date
                        ? `${campaign.start_date} – ${campaign.end_date}`
                        : campaign.end_date
                          ? `Ends ${campaign.end_date}`
                          : `From ${campaign.start_date}`}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {!selectedCampaign && (
          <p className="text-amber-600 text-xs mt-3 font-medium">{t('order', 'selectCampaignToContinue')}</p>
        )}
      </CardContent>
    </Card>
  )
}

interface CatalogPickerProps {
  stepNumber: string
  catalog: ShirtCatalogItem[]
  selectedItem: ShirtCatalogItem | null
  onSelect: (item: ShirtCatalogItem) => void
}

export function CatalogPicker({ stepNumber, catalog, selectedItem, onSelect }: CatalogPickerProps) {
  const t = useT()
  return (
    <Card className={cn('border-2 shadow-sm transition-colors', !selectedItem ? 'border-amber-300 bg-amber-50/60' : 'border-[#CEDC00]/40')}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <StepBadge n={stepNumber} />
          <div>
            <CardTitle className="text-base">{t('order', 'chooseShirt')} *</CardTitle>
            <CardDescription className="mt-0.5">{t('order', 'chooseShirtSub')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {catalog.map(item => {
            const selected = selectedItem?.id === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  'relative rounded-xl border-2 overflow-hidden text-left transition-all focus:outline-none',
                  selected
                    ? 'border-[#00352F] shadow-md ring-2 ring-[#00352F]/20'
                    : 'border-gray-200 hover:border-[#00352F]/40'
                )}
              >
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <ShirtViewer
                    frontUrl={item.image_url}
                    backUrl={item.back_image_url ?? null}
                    name={item.name}
                    variant="compact"
                  />
                  {selected && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-[#00352F] rounded-full flex items-center justify-center shadow pointer-events-none">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className={cn('p-2.5', selected ? 'bg-[#E5F2F0]' : 'bg-white')}>
                  <p className={cn('text-xs font-semibold leading-tight', selected ? 'text-[#00352F]' : 'text-gray-800')}>
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {!selectedItem && (
          <p className="text-amber-600 text-xs mt-3 font-medium">{t('order', 'selectShirtToContinue')}</p>
        )}
      </CardContent>
    </Card>
  )
}
