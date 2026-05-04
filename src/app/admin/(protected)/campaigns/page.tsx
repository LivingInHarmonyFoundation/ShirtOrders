/**
 * @file page.tsx
 * @description Admin campaign management. Supports one-time and recurring annual campaigns.
 *
 * Recurring campaigns: start_date/end_date are treated as annual month-day windows.
 * When is_active=true and today falls within the window, orders are accepted automatically.
 * No manual toggle needed each year.
 *
 * One-time campaigns: behave as before — admin manually activates/deactivates.
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSettings permission.
 */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Pencil, Trash2, Play, Square, Megaphone,
  Calendar, ShoppingBag, X, RefreshCw, RepeatIcon
} from 'lucide-react'
import type { Campaign } from '@/types'
import { useT } from '@/contexts/LanguageContext'

// ─── Helpers ──────────────────────────────────────────────────

/**
 * isInAnnualWindow — same logic as the server-side helper in /api/orders/route.ts.
 * Determines if today falls within the annual month-day window.
 */
function isInAnnualWindow(now: Date, startDate: string, endDate: string): boolean {
  const s = new Date(startDate)
  const e = new Date(endDate)
  const nowMD = now.getMonth() * 100 + now.getDate()
  const startMD = s.getMonth() * 100 + s.getDate()
  const endMD = e.getMonth() * 100 + e.getDate()
  if (startMD <= endMD) return nowMD >= startMD && nowMD <= endMD
  return nowMD >= startMD || nowMD <= endMD
}

/** Returns true if this campaign is effectively accepting orders right now. */
function isEffectivelyActive(c: Campaign): boolean {
  if (!c.is_active) return false
  if (c.is_recurring && c.start_date && c.end_date) {
    return isInAnnualWindow(new Date(), c.start_date, c.end_date)
  }
  const today = new Date().toISOString().split('T')[0]
  if (c.end_date && c.end_date < today) return false
  return true
}

/** Format a date string as "Month Day" without the year (for annual display). */
function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Compute the next upcoming start or end date for a recurring campaign. */
function nextOccurrence(dateStr: string): string {
  const ref = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const candidate = new Date(now.getFullYear(), ref.getMonth(), ref.getDate())
  if (candidate < now) candidate.setFullYear(now.getFullYear() + 1)
  return candidate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type StatusInfo = { label: string; color: string; dot: string }

function getCampaignStatus(c: Campaign): StatusInfo {
  const today = new Date().toISOString().split('T')[0]

  if (!c.is_active) {
    return { label: 'Draft', color: 'border-gray-300 text-gray-500', dot: '#9CA3AF' }
  }

  if (c.is_recurring && c.start_date && c.end_date) {
    const inWindow = isInAnnualWindow(new Date(), c.start_date, c.end_date)
    if (inWindow) {
      return { label: 'Active (Recurring)', color: 'bg-[#E5F2F0] text-[#00352F]', dot: '#00352F' }
    }
    return { label: 'Recurring · Off-season', color: 'bg-blue-50 text-blue-700', dot: '#3B82F6' }
  }

  if (c.end_date && c.end_date < today) {
    return { label: 'Ended', color: 'bg-gray-100 text-gray-500', dot: '#9CA3AF' }
  }
  if (c.start_date && c.start_date > today) {
    return { label: 'Scheduled', color: 'bg-blue-50 text-blue-700', dot: '#3B82F6' }
  }
  return { label: 'Active', color: 'bg-[#E5F2F0] text-[#00352F]', dot: '#00352F' }
}

// ─── Form default ─────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  ended_message: 'This campaign has ended. Thank you for your participation.',
  is_recurring: false,
}

// ─── Page ─────────────────────────────────────────────────────

export default function CampaignsPage() {
  const t = useT()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Data ──

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/campaigns')
      const json = await res.json()
      setCampaigns(json.campaigns || [])
    } catch {
      toast.error(t('admin', 'campaignFetchError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCampaigns() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form ──

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (c: Campaign) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      description: c.description || '',
      start_date: c.start_date || '',
      end_date: c.end_date || '',
      ended_message: c.ended_message,
      is_recurring: c.is_recurring,
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error(t('admin', 'campaignNameRequired')); return }
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/campaigns/${editingId}` : '/api/admin/campaigns'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || t('admin', 'campaignSaveError')); return }
      if (editingId) {
        setCampaigns(prev => prev.map(c => c.id === editingId ? json.campaign : c))
        toast.success(t('admin', 'campaignUpdated'))
      } else {
        setCampaigns(prev => [json.campaign, ...prev])
        toast.success(`"${json.campaign.name}" ${t('admin', 'campaignCreated')}`)
      }
      closeForm()
    } catch {
      toast.error(t('admin', 'campaignSaveError'))
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ──

  const handleToggleActive = async (campaign: Campaign) => {
    setTogglingId(campaign.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !campaign.is_active }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || t('admin', 'campaignToggleError')); return }
      if (!campaign.is_active) {
        // activating: server deactivates all others
        setCampaigns(prev => prev.map(c => ({ ...c, is_active: c.id === campaign.id })))
      } else {
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? json.campaign : c))
      }
      toast.success(campaign.is_active
        ? t('admin', 'campaignDeactivated')
        : `"${campaign.name}" ${t('admin', 'campaignActivated')}`)
    } catch {
      toast.error(t('admin', 'campaignToggleError'))
    } finally {
      setTogglingId(null)
    }
  }

  // ── Delete ──

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`Delete "${campaign.name}"? Orders linked to this campaign will remain but lose the campaign link.`)) return
    setDeletingId(campaign.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || t('admin', 'campaignDeleteError')); return }
      setCampaigns(prev => prev.filter(c => c.id !== campaign.id))
      toast.success(`"${campaign.name}" ${t('admin', 'campaignDeleted')}`)
    } catch {
      toast.error(t('admin', 'campaignDeleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Derived ──

  const effectivelyActiveCampaign = campaigns.find(isEffectivelyActive)
  const today = new Date().toISOString().split('T')[0]

  // ── Render ──

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin', 'campaignsTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('admin', 'campaignsSubtitle')}</p>
        </div>
        <Button onClick={openNew} className="text-white gap-2" style={{ backgroundColor: '#00352F' }}>
          <Plus className="w-4 h-4" /> {t('admin', 'newCampaign')}
        </Button>
      </div>

      {/* Active campaign status banner */}
      {effectivelyActiveCampaign ? (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ backgroundColor: '#E5F2F0', borderColor: 'rgba(0,53,47,0.2)' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: '#00352F' }} />
          <p className="text-sm font-medium" style={{ color: '#00352F' }}>
            &ldquo;{effectivelyActiveCampaign.name}&rdquo; {t('admin', 'campaignIsLive')}
            {effectivelyActiveCampaign.is_recurring && effectivelyActiveCampaign.end_date && (
              <span className="font-normal opacity-70">
                {' '}· {t('admin', 'recurringEndsOn')} {formatMonthDay(effectivelyActiveCampaign.end_date)}
              </span>
            )}
          </p>
        </div>
      ) : campaigns.some(c => c.is_active) ? (
        // An is_active=true campaign exists but it's in off-season (recurring)
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <RefreshCw className="w-4 h-4 flex-shrink-0 text-blue-500" />
          <p className="text-sm font-medium text-blue-800">
            {t('admin', 'campaignOffSeason')}
            {(() => {
              const c = campaigns.find(x => x.is_active && x.is_recurring && x.start_date)
              return c?.start_date
                ? <span className="font-normal"> · {t('admin', 'recurringResumesOn')} {nextOccurrence(c.start_date)}</span>
                : null
            })()}
          </p>
        </div>
      ) : null}

      {/* Create / Edit form */}
      {showForm && (
        <Card className="border-[#CEDC00]/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {editingId ? t('admin', 'editCampaign') : t('admin', 'newCampaign')}
                </CardTitle>
                <CardDescription>
                  {editingId ? t('admin', 'editCampaignDesc') : t('admin', 'createCampaignDesc')}
                </CardDescription>
              </div>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">

              {/* Name */}
              <div>
                <Label htmlFor="camp-name">{t('admin', 'campaignNameLabel')}</Label>
                <Input
                  id="camp-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('admin', 'campaignNamePlaceholder')}
                  className="mt-1"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="camp-desc">{t('admin', 'campaignDescLabel')}</Label>
                <Textarea
                  id="camp-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('admin', 'campaignDescPlaceholder')}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>

              {/* Recurring toggle */}
              <div
                className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors"
                style={{
                  borderColor: form.is_recurring ? '#00352F' : 'transparent',
                  backgroundColor: form.is_recurring ? '#E5F2F0' : '#F9FAFB',
                }}
                onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
              >
                <input
                  id="camp-recurring"
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                  onClick={e => e.stopPropagation()}
                  className="mt-0.5 w-4 h-4 accent-[#00352F]"
                />
                <div>
                  <label htmlFor="camp-recurring" className="font-medium text-sm cursor-pointer flex items-center gap-1.5">
                    <RepeatIcon className="w-3.5 h-3.5" style={{ color: '#00352F' }} />
                    {t('admin', 'recurringCampaign')}
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">{t('admin', 'recurringCampaignDesc')}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="camp-start">
                    {form.is_recurring ? t('admin', 'annualStartLabel') : t('admin', 'startDateLabel')}
                  </Label>
                  <Input
                    id="camp-start"
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="camp-end">
                    {form.is_recurring ? t('admin', 'annualEndLabel') : t('admin', 'endDateLabel')}
                  </Label>
                  <Input
                    id="camp-end"
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Recurring explanation */}
              {form.is_recurring && form.start_date && form.end_date && (
                <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2.5 bg-blue-50 border border-blue-100 text-blue-800">
                  <RepeatIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p>
                    {t('admin', 'recurringPreview')}{' '}
                    <strong>{formatMonthDay(form.start_date)}</strong> → <strong>{formatMonthDay(form.end_date)}</strong>{' '}
                    {t('admin', 'recurringPreviewEveryYear')}
                  </p>
                </div>
              )}

              {/* Ended message (non-recurring only) */}
              {!form.is_recurring && (
                <div>
                  <Label htmlFor="camp-msg">{t('admin', 'endedMessageLabel')}</Label>
                  <Textarea
                    id="camp-msg"
                    value={form.ended_message}
                    onChange={e => setForm(f => ({ ...f, ended_message: e.target.value }))}
                    className="mt-1 resize-none"
                    rows={2}
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('admin', 'endedMessageDesc')}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving} className="text-white" style={{ backgroundColor: '#00352F' }}>
                  {saving ? t('admin', 'savingCampaign') : editingId ? t('admin', 'saveChanges') : t('admin', 'createCampaign')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  {t('admin', 'cancelCampaign')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Campaign list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Megaphone className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900">{t('admin', 'noCampaignsYet')}</p>
            <p className="text-gray-500 text-sm mt-1">{t('admin', 'noCampaignsDesc')}</p>
            <Button onClick={openNew} className="mt-4 text-white gap-2" style={{ backgroundColor: '#00352F' }}>
              <Plus className="w-4 h-4" /> {t('admin', 'newCampaign')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const { label, color, dot } = getCampaignStatus(campaign)
            const effectiveNow = isEffectivelyActive(campaign)

            return (
              <div
                key={campaign.id}
                className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${
                  effectiveNow ? 'border-[#00352F]/30 shadow-sm' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: effectiveNow ? '#E5F2F0' : '#F9FAFB' }}
                  >
                    {campaign.is_recurring
                      ? <RepeatIcon className="w-5 h-5" style={{ color: campaign.is_active ? '#00352F' : '#9CA3AF' }} />
                      : <Megaphone className="w-5 h-5" style={{ color: effectiveNow ? '#00352F' : '#9CA3AF' }} />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{campaign.name}</h3>
                      <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0 ${color}`}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: dot }} />
                        {label}
                      </Badge>
                      {campaign.is_recurring && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0 text-blue-600 border-blue-200">
                          <RepeatIcon className="w-2.5 h-2.5 mr-1" /> {t('admin', 'annual')}
                        </Badge>
                      )}
                    </div>

                    {campaign.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {/* Date display */}
                      {(campaign.start_date || campaign.end_date) && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {campaign.is_recurring
                            ? `${campaign.start_date ? formatMonthDay(campaign.start_date) : '—'} → ${campaign.end_date ? formatMonthDay(campaign.end_date) : '—'} (annual)`
                            : `${campaign.start_date || '—'} → ${campaign.end_date || '—'}`}
                        </span>
                      )}

                      {/* Next occurrence hint for off-season recurring */}
                      {campaign.is_recurring && campaign.is_active && !effectiveNow && campaign.start_date && (
                        <span className="flex items-center gap-1 text-xs text-blue-500">
                          <RefreshCw className="w-3 h-3" />
                          {t('admin', 'recurringResumesOn')} {nextOccurrence(campaign.start_date)}
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <ShoppingBag className="w-3 h-3" />
                        {campaign.order_count ?? 0} {t('admin', 'orders')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(campaign)}
                      disabled={togglingId === campaign.id}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        campaign.is_active
                          ? 'text-gray-500 hover:bg-gray-100'
                          : 'text-[#00352F] hover:bg-[#E5F2F0]'
                      }`}
                      title={campaign.is_active ? t('admin', 'deactivateCampaign') : t('admin', 'activateCampaign')}
                    >
                      {campaign.is_active
                        ? <><Square className="w-3 h-3" /> {t('admin', 'deactivateCampaign')}</>
                        : <><Play className="w-3 h-3" /> {t('admin', 'activateCampaign')}</>}
                    </button>
                    <button
                      onClick={() => openEdit(campaign)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(campaign)}
                      disabled={deletingId === campaign.id || campaign.is_active}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={campaign.is_active ? t('admin', 'deactivateBeforeDelete') : t('admin', 'deleteCampaignBtn')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Explanation footer */}
      {campaigns.some(c => c.is_recurring) && (
        <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-50 border rounded-lg p-3">
          <RepeatIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{t('admin', 'recurringFootnote')}</p>
        </div>
      )}
    </div>
  )
}
