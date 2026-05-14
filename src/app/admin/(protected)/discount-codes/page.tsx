/**
 * @file page.tsx
 * @description Admin discount codes management page.
 * Allows admins to create, enable/disable, and delete promotional discount codes
 * that customers can enter at checkout to receive a price reduction.
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSettings permission.
 */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tag, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react'
import { useT } from '@/contexts/LanguageContext'
import type { DiscountCode } from '@/types'

const EMPTY_FORM = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: '',
  expires_at: '',
  enabled: true,
  max_uses: '',
  restricted_to_type: '',
  restricted_to_name: '',
}

/**
 * formatDiscountValue — returns a human-readable representation of the discount.
 * e.g. "15%" for percentage, "$5.00" for fixed.
 */
function formatDiscountValue(code: DiscountCode): string {
  if (code.type === 'percentage') return `${code.value}%`
  return `$${Number(code.value).toFixed(2)}`
}

/**
 * isExpired — returns true if the code has a past expiry date.
 */
function isExpired(code: DiscountCode): boolean {
  if (!code.expires_at) return false
  return new Date(code.expires_at) < new Date()
}

/**
 * formatExpiry — formats the expiry date for display, or returns a "Never" key.
 */
function formatExpiry(code: DiscountCode, neverLabel: string, expiredLabel: string): string {
  if (!code.expires_at) return neverLabel
  const date = new Date(code.expires_at)
  const formatted = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  if (isExpired(code)) return `${formatted} (${expiredLabel})`
  return formatted
}

/**
 * DiscountCodesPage — full CRUD for discount codes. Admins can create new codes
 * with a dialog form, toggle enabled state inline, and delete codes with confirmation.
 */
export default function DiscountCodesPage() {
  const t = useT()

  const [codes, setCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/admin/discount-codes')
      .then(r => r.json())
      .then(data => setCodes(data.discountCodes || []))
      .catch(() => toast.error(t('admin', 'discountCodeError')))
      .finally(() => setLoading(false))
  }, [t])

  // ── Handlers ──────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.value) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: parseFloat(form.value),
          expires_at: form.expires_at || null,
          enabled: form.enabled,
          max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
          restricted_to_type: form.restricted_to_type || null,
          restricted_to_name: form.restricted_to_name.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t('admin', 'discountCodeError'))
        return
      }
      setCodes(prev => [data.discountCode, ...prev])
      toast.success(t('admin', 'discountCodeCreated'))
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    } catch {
      toast.error(t('admin', 'discountCodeError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleEnabled = async (code: DiscountCode) => {
    setTogglingId(code.id)
    try {
      const res = await fetch(`/api/admin/discount-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !code.enabled }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || t('admin', 'discountCodeError'))
        return
      }
      setCodes(prev => prev.map(c => c.id === code.id ? data.discountCode : c))
      toast.success(t('admin', 'discountCodeUpdated'))
    } catch {
      toast.error(t('admin', 'discountCodeError'))
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/discount-codes/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || t('admin', 'discountCodeError'))
        return
      }
      setCodes(prev => prev.filter(c => c.id !== id))
      toast.success(t('admin', 'discountCodeDeleted'))
    } catch {
      toast.error(t('admin', 'discountCodeError'))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#00352F' }}>
            {t('admin', 'discountCodes')}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('admin', 'discountCodesSubtitle')}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setForm(EMPTY_FORM) }}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ backgroundColor: '#00352F', color: 'white' }}
          >
            <Plus className="w-4 h-4" />
            {t('admin', 'addDiscountCode')}
          </DialogTrigger>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('admin', 'newDiscountCode')}</DialogTitle>
              <p className="text-sm text-gray-500">{t('admin', 'newDiscountCodeDesc')}</p>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              {/* Code */}
              <div className="space-y-1.5">
                <Label htmlFor="dc-code">{t('admin', 'discountCodeLabel')}</Label>
                <Input
                  id="dc-code"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder={t('admin', 'discountCodePlaceholder')}
                  required
                  className="font-mono uppercase"
                />
              </div>

              {/* Type + Value row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dc-type">{t('admin', 'discountTypeLabel')}</Label>
                  <select
                    id="dc-type"
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="percentage">{t('admin', 'discountTypePercentage')}</option>
                    <option value="fixed">{t('admin', 'discountTypeFixed')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dc-value">{t('admin', 'discountValueLabel')}</Label>
                  <Input
                    id="dc-value"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={form.type === 'percentage' ? '10' : '5.00'}
                    required
                  />
                </div>
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <Label htmlFor="dc-expiry">
                  {t('admin', 'discountExpiryLabel')}{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  id="dc-expiry"
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                />
              </div>

              {/* Max Uses */}
              <div className="space-y-1.5">
                <Label htmlFor="dc-max-uses">
                  Max Uses{' '}
                  <span className="text-gray-400 font-normal text-xs">(leave blank for unlimited)</span>
                </Label>
                <Input
                  id="dc-max-uses"
                  type="number"
                  min="1"
                  step="1"
                  value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                  placeholder="Unlimited"
                />
              </div>

              {/* Restriction */}
              <div className="space-y-1.5">
                <Label htmlFor="dc-restrict-type">
                  Restrict to Institution Type{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </Label>
                <select
                  id="dc-restrict-type"
                  value={form.restricted_to_type}
                  onChange={e => setForm(f => ({ ...f, restricted_to_type: e.target.value, restricted_to_name: '' }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">No restriction</option>
                  <option value="school">School</option>
                  <option value="government">Government Agency</option>
                  <option value="private_company">Private Company</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              {form.restricted_to_type && form.restricted_to_type !== 'personal' && (
                <div className="space-y-1.5">
                  <Label htmlFor="dc-restrict-name">
                    Specific {form.restricted_to_type === 'school' ? 'school' : form.restricted_to_type === 'government' ? 'agency' : 'company'} name{' '}
                    <span className="text-gray-400 font-normal text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="dc-restrict-name"
                    value={form.restricted_to_name}
                    onChange={e => setForm(f => ({ ...f, restricted_to_name: e.target.value }))}
                    placeholder={`e.g. ${form.restricted_to_type === 'school' ? 'Lincoln High School' : form.restricted_to_type === 'government' ? 'City Hall' : 'Acme Corp'}`}
                  />
                </div>
              )}

              {/* Enabled */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border">
                <input
                  id="dc-enabled"
                  type="checkbox"
                  checked={form.enabled}
                  onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#00352F]"
                />
                <div>
                  <Label htmlFor="dc-enabled" className="cursor-pointer font-medium">
                    {t('admin', 'discountEnabledLabel')}
                  </Label>
                  <p className="text-xs text-gray-500">{t('admin', 'discountEnabledDesc')}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setDialogOpen(false); setForm(EMPTY_FORM) }}
                >
                  {t('common', 'cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1"
                  style={{ backgroundColor: '#00352F', color: 'white' }}
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('admin', 'addingDiscountCode')}</>
                  ) : (
                    t('admin', 'addDiscountCodeButton')
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      ) : codes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#E5F2F0' }}
            >
              <Tag className="w-6 h-6" style={{ color: '#00352F' }} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{t('admin', 'noDiscountCodesYet')}</h3>
            <p className="text-sm text-gray-500">{t('admin', 'noDiscountCodesDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" style={{ color: '#00352F' }} />
              {t('admin', 'discountCodes')}
              <Badge variant="secondary" className="ml-auto text-xs">{codes.length}</Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountCodeCol')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountTypeCol')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountValueCol')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountExpiryCol')}
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      Uses
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      Restriction
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountEnabledCol')}
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      {t('admin', 'discountActionsCol')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {codes.map(code => {
                    const expired = isExpired(code)
                    const isToggling = togglingId === code.id
                    const isDeleting = deletingId === code.id
                    const confirmingDelete = confirmDeleteId === code.id

                    return (
                      <tr key={code.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Code */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-[#00352F] bg-[#E5F2F0] px-2 py-0.5 rounded text-xs tracking-wider">
                            {code.code}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3 text-gray-600 capitalize">
                          {code.type === 'percentage'
                            ? t('admin', 'discountTypePercentage')
                            : t('admin', 'discountTypeFixed')}
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {formatDiscountValue(code)}
                        </td>

                        {/* Expiry */}
                        <td className={`px-4 py-3 ${expired ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {formatExpiry(
                            code,
                            t('admin', 'discountNeverExpires'),
                            t('admin', 'discountExpired')
                          )}
                        </td>

                        {/* Uses */}
                        <td className="px-4 py-3 text-sm">
                          {code.max_uses == null ? (
                            <span className="text-gray-400">∞</span>
                          ) : (() => {
                            const used = code.times_used ?? 0
                            const exhausted = used >= code.max_uses
                            const nearLimit = !exhausted && code.max_uses > 0 && used / code.max_uses >= 0.8
                            return (
                              <span className={`font-medium ${exhausted ? 'text-red-600' : nearLimit ? 'text-amber-600' : 'text-gray-700'}`}>
                                {used} / {code.max_uses}
                              </span>
                            )
                          })()}
                        </td>

                        {/* Restriction */}
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {code.restricted_to_type ? (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="capitalize font-medium text-[#00352F]">{code.restricted_to_type.replace('_', ' ')}</span>
                              {code.restricted_to_name && (
                                <span className="text-xs text-gray-500">{code.restricted_to_name}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Enabled toggle */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleEnabled(code)}
                            disabled={isToggling}
                            className="flex items-center gap-1.5 transition-opacity disabled:opacity-50"
                            title={code.enabled ? t('admin', 'discountCodeEnabled') : t('admin', 'discountCodeDisabled')}
                          >
                            {isToggling ? (
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : code.enabled ? (
                              <ToggleRight className="w-6 h-6" style={{ color: '#00352F' }} />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-gray-400" />
                            )}
                            <span className={`text-xs font-medium ${code.enabled ? 'text-[#00352F]' : 'text-gray-400'}`}>
                              {code.enabled ? t('admin', 'discountCodeEnabled') : t('admin', 'discountCodeDisabled')}
                            </span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          {confirmingDelete ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">{t('admin', 'confirmDeleteDiscount')}</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={isDeleting}
                                onClick={() => handleDelete(code.id)}
                                className="h-7 px-2 text-xs"
                              >
                                {isDeleting
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : t('admin', 'deleteDiscountCode')
                                }
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDeleteId(null)}
                                className="h-7 px-2 text-xs"
                              >
                                {t('common', 'cancel')}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(code.id)}
                              className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info note */}
      {codes.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
          <p>
            Codes are case-insensitive at checkout. Customers enter the code and the discount is applied to their order total before payment.
          </p>
        </div>
      )}
    </div>
  )
}
