/**
 * @file SizePicker.tsx
 * @description Shared size selector for all order forms. When size categories are
 * available (admin-configured app_settings.size_groups, or defaults derived from
 * the size names), the customer first picks a category box (Adultos / Jóvenes /
 * Niños…) and then sees only that category's sizes — instead of one long row of
 * every size. Falls back to the classic flat chip row when there's only one
 * category (e.g. an item with adult sizes only).
 *
 * Key invariants:
 * - Selecting a category never clears the chosen size; the running summary stays.
 * - Sizes in no category appear under an automatic "Other" category (translated).
 * - `sizes` is the item's already stock-filtered list; categories only regroup it.
 */
'use client'

import { useState } from 'react'
import { cn, deriveDefaultSizeGroups, sortSizesForDisplay } from '@/lib/utils'
import { useT } from '@/contexts/LanguageContext'
import type { SizeGroup } from '@/types'

interface SizePickerProps {
  sizes: string[]
  selectedSize: string
  onSelectSize: (size: string) => void
  /** Admin-defined categories; null/empty → defaults derived from size names. */
  sizeGroups?: SizeGroup[] | null
}

export default function SizePicker({ sizes, selectedSize, onSelectSize, sizeGroups }: SizePickerProps) {
  const t = useT()
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  // Resolve categories: admin config wins, else derive from the size names.
  const source = sizeGroups && sizeGroups.length > 0 ? sizeGroups : deriveDefaultSizeGroups(sizes)
  const grouped = source
    .map(g => ({ name: g.name, sizes: g.sizes.filter(s => sizes.includes(s)) }))
    .filter(g => g.sizes.length > 0)
  const assigned = new Set(grouped.flatMap(g => g.sizes))
  const leftovers = sizes.filter(s => !assigned.has(s))
  if (leftovers.length > 0) grouped.push({ name: t('order', 'sizeCategoryOther'), sizes: leftovers })

  const chips = (list: string[]) => (
    <div className="flex flex-wrap gap-2 mt-2" role="radiogroup" aria-label={t('order', 'shirtSize')}>
      {sortSizesForDisplay(list).map(size => (
        <button
          key={size}
          type="button"
          role="radio"
          aria-checked={selectedSize === size}
          onClick={() => onSelectSize(size)}
          className={cn(
            'min-w-[52px] px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150',
            selectedSize === size
              ? 'border-[#00352F] bg-[#E5F2F0] text-[#00352F] shadow-sm'
              : 'border-gray-200 bg-white hover:border-[#00352F]/30 hover:bg-[#F5F4F0] text-gray-600'
          )}
        >
          {size}
        </button>
      ))}
    </div>
  )

  // One category (or none) → the classic flat row.
  if (grouped.length <= 1) return chips(sizes)

  // Auto-open the category that holds the current selection.
  const activeName = openGroup ?? (selectedSize ? grouped.find(g => g.sizes.includes(selectedSize))?.name ?? null : null)
  const activeGroup = grouped.find(g => g.name === activeName) ?? null

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2" role="tablist" aria-label={t('order', 'shirtSize')}>
        {grouped.map(g => {
          const isActive = g.name === activeName
          const holdsSelection = !!selectedSize && g.sizes.includes(selectedSize)
          return (
            <button
              key={g.name}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setOpenGroup(g.name)}
              className={cn(
                'rounded-xl border-2 px-3 py-3 text-center transition-all duration-150',
                isActive
                  ? 'border-[#00352F] bg-[#E5F2F0] shadow-sm'
                  : 'border-gray-200 bg-white hover:border-[#00352F]/30 hover:bg-[#F5F4F0]'
              )}
            >
              <span className={cn('block text-sm font-semibold', isActive ? 'text-[#00352F]' : 'text-gray-700')}>
                {g.name}
              </span>
              <span className="block text-[11px] text-gray-400 mt-0.5">
                {holdsSelection ? (
                  <span className="font-semibold text-[#00352F]">{selectedSize} ✓</span>
                ) : (
                  <>{g.sizes.length} {t('order', 'sizesWord')}</>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {activeGroup ? (
        chips(activeGroup.sizes)
      ) : (
        <p className="text-xs text-gray-400 mt-2">{t('order', 'sizeCategoryHint')}</p>
      )}
    </div>
  )
}
