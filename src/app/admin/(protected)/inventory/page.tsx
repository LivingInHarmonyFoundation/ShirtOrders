/**
 * @file page.tsx
 * @description Admin inventory management page. Displays shirt stock per size,
 * grouped by catalog item (Section 1) and general inventory (Section 2).
 *
 * Size chips are color-coded by stock level:
 *   - Green  → qty > threshold
 *   - Amber  → 0 < qty ≤ threshold
 *   - Red    → qty ≤ 0
 *
 * Clicking a chip expands an inline editor for quantity + threshold.
 * Save calls PATCH (existing row) or POST (new row) on /api/admin/inventory.
 *
 * Auth: provided by the (protected) layout.
 */
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@/contexts/LanguageContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Archive, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ShirtInventoryItem, ShirtCatalogItem } from '@/types'

// ─── Types ────────────────────────────────────────────────────

interface EditState {
  rowId: string | null       // null = no existing row (will POST)
  catalogItemId: string | null
  size: string
  quantity: number
  threshold: number
  saving: boolean
  error: string | null
}

// ─── Helpers ─────────────────────────────────────────────────

/** Returns the chip color class based on quantity vs threshold. */
function chipColor(qty: number, threshold: number): 'green' | 'amber' | 'red' {
  if (qty <= 0) return 'red'
  if (qty <= threshold) return 'amber'
  return 'green'
}

const COLOR_CHIP: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
  red:   'bg-red-100   text-red-800   border-red-200   hover:bg-red-200',
}

const COLOR_CHIP_EMPTY = 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

// ─── Sub-components ───────────────────────────────────────────

interface SizeChipProps {
  size: string
  invRow: ShirtInventoryItem | undefined
  isEditing: boolean
  onClick: () => void
}

function SizeChip({ size, invRow, isEditing, onClick }: SizeChipProps) {
  const color = invRow ? chipColor(invRow.quantity, invRow.low_stock_threshold) : null
  const chipCls = color ? COLOR_CHIP[color] : COLOR_CHIP_EMPTY

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 text-xs font-semibold transition-all duration-150 flex-shrink-0',
        chipCls,
        isEditing && 'ring-2 ring-offset-1 ring-[#00352F]'
      )}
    >
      <span className="text-sm font-bold leading-tight">{size}</span>
      {invRow !== undefined ? (
        <span className="text-[11px] leading-tight opacity-80">{invRow.quantity}</span>
      ) : (
        <span className="text-[10px] leading-tight opacity-50">—</span>
      )}
    </button>
  )
}

interface InlineEditorProps {
  edit: EditState
  onQuantityChange: (v: number) => void
  onThresholdChange: (v: number) => void
  onSave: () => void
  onCancel: () => void
  t: ReturnType<typeof useT>
}

function InlineEditor({ edit, onQuantityChange, onThresholdChange, onSave, onCancel, t }: InlineEditorProps) {
  return (
    <div
      className="mt-3 p-4 rounded-xl border-2 border-[#00352F]/20 bg-[#E5F2F0] space-y-3"
      style={{ borderColor: 'rgba(0,53,47,0.15)' }}
    >
      <p className="text-xs font-semibold text-[#00352F] uppercase tracking-wide">
        {edit.size}
      </p>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-600 font-medium block mb-1">
            {t('admin', 'currentStock')}
          </label>
          <Input
            type="number"
            value={edit.quantity}
            onChange={e => onQuantityChange(Number(e.target.value))}
            className="h-8 text-sm bg-white"
          />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-gray-600 font-medium block mb-1">
            {t('admin', 'alertBelow')}
          </label>
          <Input
            type="number"
            min={0}
            value={edit.threshold}
            onChange={e => onThresholdChange(Number(e.target.value))}
            className="h-8 text-sm bg-white"
          />
        </div>
      </div>
      {edit.error && (
        <p className="text-xs text-red-600">{edit.error}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onSave}
          disabled={edit.saving}
          className="h-7 text-xs text-white"
          style={{ backgroundColor: '#00352F' }}
        >
          {edit.saving ? '…' : t('admin', 'saveInventory')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={edit.saving}
          className="h-7 text-xs"
        >
          {t('admin', 'cancel')}
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function InventoryPage() {
  const t = useT()

  const [inventory, setInventory] = useState<ShirtInventoryItem[]>([])
  const [catalogItems, setCatalogItems] = useState<ShirtCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Data loading ──

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, catRes] = await Promise.all([
        fetch('/api/admin/inventory'),
        fetch('/api/admin/catalog'),
      ])
      const invJson = await invRes.json()
      const catJson = await catRes.json()
      setInventory(invJson.inventory || [])
      setCatalogItems((catJson.items || []).filter((c: ShirtCatalogItem) => c.is_active))
    } catch {
      // ignore — page will show empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived data ──

  const lowStockItems = inventory.filter(
    row => row.catalog_item_id !== null && row.quantity <= row.low_stock_threshold
  )

  /** Returns the inventory row for a given catalog item + size, or undefined */
  function getRow(catalogItemId: string | null, size: string): ShirtInventoryItem | undefined {
    return inventory.find(r =>
      r.shirt_size === size &&
      (catalogItemId === null ? r.catalog_item_id === null : r.catalog_item_id === catalogItemId)
    )
  }

  // ── Edit handlers ──

  function openEditor(catalogItemId: string | null, size: string) {
    const existing = getRow(catalogItemId, size)
    setEdit({
      rowId: existing?.id ?? null,
      catalogItemId,
      size,
      quantity: existing?.quantity ?? 0,
      threshold: existing?.low_stock_threshold ?? 10,
      saving: false,
      error: null,
    })
  }

  function closeEditor() {
    setEdit(null)
  }

  function isEditing(catalogItemId: string | null, size: string): boolean {
    if (!edit) return false
    return edit.size === size && edit.catalogItemId === catalogItemId
  }

  async function handleSave() {
    if (!edit) return
    setEdit(prev => prev ? { ...prev, saving: true, error: null } : null)

    try {
      let res: Response
      if (edit.rowId) {
        // Existing row — PATCH
        res = await fetch(`/api/admin/inventory/${edit.rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: edit.quantity, low_stock_threshold: edit.threshold }),
        })
      } else {
        // New row — POST
        res = await fetch('/api/admin/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalog_item_id: edit.catalogItemId,
            shirt_size: edit.size,
            quantity: edit.quantity,
            low_stock_threshold: edit.threshold,
          }),
        })
      }

      if (!res.ok) {
        const json = await res.json()
        setEdit(prev => prev ? { ...prev, saving: false, error: json.error || t('admin', 'inventoryError') } : null)
        return
      }

      const json = await res.json()
      const updatedItem: ShirtInventoryItem = json.item

      // Optimistically update local state
      setInventory(prev => {
        const idx = prev.findIndex(r => r.id === updatedItem.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updatedItem
          return next
        }
        return [...prev, updatedItem]
      })

      setSuccessMsg(t('admin', 'inventorySaved'))
      setTimeout(() => setSuccessMsg(null), 2500)
      setEdit(null)
    } catch {
      setEdit(prev => prev ? { ...prev, saving: false, error: t('admin', 'inventoryError') } : null)
    }
  }

  // ── Render helpers ──

  function renderSizeGrid(catalogItemId: string | null, sizes: string[] = ALL_SIZES) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {sizes.map(size => (
            <SizeChip
              key={size}
              size={size}
              invRow={getRow(catalogItemId, size)}
              isEditing={isEditing(catalogItemId, size)}
              onClick={() => {
                if (isEditing(catalogItemId, size)) {
                  closeEditor()
                } else {
                  openEditor(catalogItemId, size)
                }
              }}
            />
          ))}
        </div>

        {edit && edit.catalogItemId === catalogItemId && (
          <InlineEditor
            edit={edit}
            onQuantityChange={v => setEdit(prev => prev ? { ...prev, quantity: v } : null)}
            onThresholdChange={v => setEdit(prev => prev ? { ...prev, threshold: v } : null)}
            onSave={handleSave}
            onCancel={closeEditor}
            t={t}
          />
        )}
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E5F2F0' }}>
              <Archive className="w-4 h-4" style={{ color: '#00352F' }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin', 'inventory')}</h1>
          </div>
          <p className="text-sm text-gray-500">{t('admin', 'inventorySubtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="gap-1.5 text-xs flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('admin', 'refresh')}
        </Button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Low stock banner */}
      {!loading && lowStockItems.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 flex gap-3"
          style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d' }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {lowStockItems.length} {t('admin', 'lowStockBanner')}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">{t('admin', 'lowStockAlertDesc')}:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {lowStockItems.map(item => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: item.quantity <= 0 ? '#fee2e2' : '#fef3c7',
                    color: item.quantity <= 0 ? '#991b1b' : '#92400e',
                  }}
                >
                  {item.catalog_item_name ? `${item.catalog_item_name} — ` : ''}{item.shirt_size}: {item.quantity}
                  {item.quantity <= 0 && (
                    <XCircle className="w-3 h-3" />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-200" />
            {t('admin', 'inStock')}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-200" />
            {t('admin', 'lowStock')}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-200" />
            {t('admin', 'outOfStock')}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200" />
            {t('admin', 'noInventorySetup')}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2">
                  {ALL_SIZES.map(s => <Skeleton key={s} className="w-16 h-16 rounded-xl" />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Section 1: Catalog Item Inventory */}
          {catalogItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                {t('admin', 'catalogInventory')}
              </h2>
              <div className="space-y-3">
                {catalogItems.map(catItem => (
                  <Card key={catItem.id}>
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#CEDC00' }} />
                        {catItem.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      {renderSizeGrid(catItem.id, catItem.available_sizes?.length ? catItem.available_sizes : ALL_SIZES)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when nothing is set up at all */}
          {catalogItems.length === 0 && inventory.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">{t('admin', 'noInventorySetup')}</p>
              <p className="text-sm mt-1">{t('admin', 'noInventorySetupDesc')}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
