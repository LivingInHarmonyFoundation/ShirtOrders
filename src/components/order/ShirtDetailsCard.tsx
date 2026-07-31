/**
 * @file ShirtDetailsCard.tsx
 * @description Shared "Shirt Details" section (selected-shirt summary + size picker +
 * quantity + notes) and the "This Item" order summary, extracted from the duplicated
 * order forms. Preserves the exact markup/styling of the main + campaign forms.
 *
 * Type-safe: the parent passes already-registered react-hook-form fields plus the size
 * selection state; this component owns no form schema knowledge and uses useT() internally.
 */
'use client'

import type { UseFormRegisterReturn } from 'react-hook-form'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import SizePicker from '@/components/order/SizePicker'
import type { ShirtCatalogItem, SizeGroup } from '@/types'

interface ShirtDetailsCardProps {
  stepNumber: string
  selectedCatalogItem: ShirtCatalogItem | null
  /** True when there's exactly one catalog item (shows the selected-shirt summary strip). */
  showSelectedShirtSummary: boolean
  sizes: string[]
  selectedSize: string
  onSelectSize: (size: string) => void
  sizeError?: string
  /** Admin-defined size categories (settings.size_groups); omitted → derived defaults. */
  sizeGroups?: SizeGroup[] | null
  quantityReg: UseFormRegisterReturn
  quantityError?: string
  notesReg: UseFormRegisterReturn
}

export default function ShirtDetailsCard({
  stepNumber,
  selectedCatalogItem,
  showSelectedShirtSummary,
  sizes,
  selectedSize,
  onSelectSize,
  sizeError,
  sizeGroups,
  quantityReg,
  quantityError,
  notesReg,
}: ShirtDetailsCardProps) {
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
          <CardTitle className="text-base">{t('order', 'shirtDetails')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selected-shirt summary — shown when there's exactly one catalog item */}
        {showSelectedShirtSummary && selectedCatalogItem && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#E5F2F0] border border-[#CEDC00]/30">
            {selectedCatalogItem.image_url ? (
              <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                <Image src={selectedCatalogItem.image_url} alt={selectedCatalogItem.name} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-[#00352F]/40" />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">{t('order', 'selectedShirt')}</p>
              <p className="font-semibold text-[#00352F] text-sm">{selectedCatalogItem.name}</p>
            </div>
          </div>
        )}

        <div>
          <Label>{t('order', 'shirtSize')} *</Label>
          <SizePicker sizes={sizes} selectedSize={selectedSize} onSelectSize={onSelectSize} sizeGroups={sizeGroups} />
          {sizeError && <p role="alert" className="text-red-600 text-xs mt-1">{sizeError}</p>}
        </div>

        <div>
          <Label htmlFor="quantity">{t('order', 'quantity')} *</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max="999"
            {...quantityReg}
            className="mt-1 max-w-[140px]"
          />
          {quantityError && <p role="alert" className="text-red-600 text-xs mt-1">{quantityError}</p>}
        </div>

        <div>
          <Label htmlFor="notes">{t('order', 'notes')}</Label>
          <Textarea id="notes" {...notesReg} placeholder={t('order', 'notesPlaceholder')} className="mt-1" rows={3} />
        </div>
      </CardContent>
    </Card>
  )
}

interface OrderItemSummaryProps {
  catalogItemName?: string
  size: string
  quantity: number
  unitPrice: number
}

/** "This Item" running summary — renders only when a size and positive quantity are set. */
export function OrderItemSummary({ catalogItemName, size, quantity, unitPrice }: OrderItemSummaryProps) {
  const t = useT()
  if (!size || quantity <= 0) return null
  return (
    <Card className="border-0 shadow-sm" style={{ backgroundColor: '#E5F2F0' }}>
      <CardContent className="p-5">
        <h3 className="font-heading font-semibold text-base mb-3" style={{ color: '#00352F' }}>{t('order', 'thisItem')}</h3>
        <div className="space-y-1 text-sm">
          {catalogItemName && (
            <div className="flex justify-between text-gray-600">
              <span>{t('order', 'style')}</span>
              <span className="font-medium text-gray-800">{catalogItemName}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>{t('order', 'sizeRow')} {size} × {quantity}</span>
            <span>{formatCurrency(unitPrice)} {t('order', 'each')}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-gray-900">
            <span>{t('order', 'subtotal')}</span>
            <span className="text-[#00352F]">{formatCurrency(unitPrice * (quantity || 0))}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
