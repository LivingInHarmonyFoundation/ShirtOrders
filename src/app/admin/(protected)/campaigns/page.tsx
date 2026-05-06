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

import { useEffect, useRef, useState } from 'react'
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
  Calendar, ShoppingBag, X, RefreshCw, RepeatIcon, Upload, Loader2, ExternalLink, Shirt, Check,
} from 'lucide-react'
import Image from 'next/image'
import type { Campaign, ShirtCatalogItem } from '@/types'
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
  slug: '',
  banner_url: '',
  badge_url: '',
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
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingBadge, setUploadingBadge] = useState(false)
  const bannerRef = useRef<HTMLInputElement>(null)
  const badgeRef = useRef<HTMLInputElement>(null)

  // Item assignment panel
  const [managingItemsCampaignId, setManagingItemsCampaignId] = useState<string | null>(null)
  const [allCatalogItems, setAllCatalogItems] = useState<ShirtCatalogItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [savingItems, setSavingItems] = useState(false)

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
      slug: c.slug || '',
      banner_url: c.banner_url || '',
      badge_url: c.badge_url || '',
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'banner_url' | 'badge_url',
    ref: React.RefObject<HTMLInputElement | null>,
    setUploading: (v: boolean) => void,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    if (ref.current) ref.current.value = ''
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const upRes = await fetch('/api/admin/catalog/upload', { method: 'POST', body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok) { toast.error(upJson.error || 'Upload failed'); return }
      setForm(f => ({ ...f, [field]: upJson.url }))
    } catch {
      toast.error('Something went wrong')
    } finally {
      setUploading(false)
    }
  }

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
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim() || null,
          banner_url: form.banner_url || null,
          badge_url: form.badge_url || null,
        }),
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
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? json.campaign : c))
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

  // ── Item assignment ──

  const openItemsPanel = async (campaign: Campaign) => {
    setManagingItemsCampaignId(campaign.id)
    setLoadingItems(true)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/catalog`)
      const json = await res.json()
      setAllCatalogItems(json.all_items || [])
      setSelectedItemIds(json.assigned_ids || [])
    } catch {
      toast.error('Failed to load catalog items')
    } finally {
      setLoadingItems(false)
    }
  }

  const closeItemsPanel = () => {
    setManagingItemsCampaignId(null)
    setAllCatalogItems([])
    setSelectedItemIds([])
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    )
  }

  const handleSaveItems = async (campaignId: string) => {
    setSavingItems(true)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/catalog`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalog_item_ids: selectedItemIds }),
      })
      if (!res.ok) { toast.error('Failed to save items'); return }
      toast.success(selectedItemIds.length === 0
        ? 'Items cleared — campaign will show all items'
        : `${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''} assigned`)
      closeItemsPanel()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSavingItems(false)
    }
  }

  // ── Derived ──

  const effectivelyActiveCampaigns = campaigns.filter(isEffectivelyActive)
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
      {effectivelyActiveCampaigns.length > 0 ? (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{ backgroundColor: '#E5F2F0', borderColor: 'rgba(0,53,47,0.2)' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: '#00352F' }} />
          <p className="text-sm font-medium" style={{ color: '#00352F' }}>
            {effectivelyActiveCampaigns.length === 1 ? (
              <>
                &ldquo;{effectivelyActiveCampaigns[0].name}&rdquo; {t('admin', 'campaignIsLive')}
                {effectivelyActiveCampaigns[0].is_recurring && effectivelyActiveCampaigns[0].end_date && (
                  <span className="font-normal opacity-70">
                    {' '}· {t('admin', 'recurringEndsOn')} {formatMonthDay(effectivelyActiveCampaigns[0].end_date)}
                  </span>
                )}
              </>
            ) : (
              <>
                {effectivelyActiveCampaigns.length} {t('admin', 'campaignsLiveCount')}:{' '}
                {effectivelyActiveCampaigns.map(c => c.name).join(', ')}
              </>
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

              {/* Slug */}
              <div>
                <Label htmlFor="camp-slug">{t('admin', 'campaignSlugLabel')}</Label>
                <Input
                  id="camp-slug"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  onBlur={() => {
                    if (!form.slug && form.name) {
                      setForm(f => ({
                        ...f,
                        slug: f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                      }))
                    }
                  }}
                  placeholder="e.g. spring-2026-drive"
                  className="mt-1 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t('admin', 'campaignSlugHelper')}
                  {form.slug && (
                    <span className="ml-1 text-[#00352F] font-medium">/campaign/{form.slug}</span>
                  )}
                </p>
              </div>

              {/* Banner image */}
              <div>
                <Label>{t('admin', 'campaignBannerLabel')}</Label>
                <p className="text-xs text-gray-400 mt-0.5 mb-2">{t('admin', 'campaignBannerDesc')}</p>
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleImageUpload(e, 'banner_url', bannerRef, setUploadingBanner)}
                />
                {form.banner_url ? (
                  <div className="space-y-2">
                    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-200">
                      <Image src={form.banner_url} alt="Campaign banner" fill className="object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={uploadingBanner}
                        onClick={() => bannerRef.current?.click()}>
                        {uploadingBanner
                          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                          : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'replaceImage')}</>}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="text-red-500 hover:text-red-600"
                        onClick={() => setForm(f => ({ ...f, banner_url: '' }))}>
                        {t('admin', 'removeBanner')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={uploadingBanner}
                    onClick={() => bannerRef.current?.click()}>
                    {uploadingBanner
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'uploadBanner')}</>}
                  </Button>
                )}
              </div>

              {/* Badge image */}
              <div>
                <Label>{t('admin', 'campaignBadgeLabel')}</Label>
                <p className="text-xs text-gray-400 mt-0.5 mb-2">{t('admin', 'campaignBadgeDesc')}</p>
                <input
                  ref={badgeRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleImageUpload(e, 'badge_url', badgeRef, setUploadingBadge)}
                />
                {form.badge_url ? (
                  <div className="space-y-2">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                      <Image src={form.badge_url} alt="Campaign badge" fill className="object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={uploadingBadge}
                        onClick={() => badgeRef.current?.click()}>
                        {uploadingBadge
                          ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                          : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'replaceBadge')}</>}
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="text-red-500 hover:text-red-600"
                        onClick={() => setForm(f => ({ ...f, badge_url: '' }))}>
                        {t('admin', 'removeBadge')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled={uploadingBadge}
                    onClick={() => badgeRef.current?.click()}>
                    {uploadingBadge
                      ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> {t('admin', 'uploading')}</>
                      : <><Upload className="w-3.5 h-3.5 mr-1.5" /> {t('admin', 'uploadBadge')}</>}
                  </Button>
                )}
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

                      {campaign.slug && (
                        <a
                          href={`/campaign/${campaign.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[#00352F] hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          /campaign/{campaign.slug}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => managingItemsCampaignId === campaign.id ? closeItemsPanel() : openItemsPanel(campaign)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        managingItemsCampaignId === campaign.id
                          ? 'bg-[#E5F2F0] text-[#00352F]'
                          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                      }`}
                      title="Manage items for this campaign"
                    >
                      <Shirt className="w-4 h-4" />
                    </button>
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

                {/* Inline items panel */}
                {managingItemsCampaignId === campaign.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Items for this campaign</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {selectedItemIds.length === 0
                            ? 'No items selected — all active items will be shown (default)'
                            : `${selectedItemIds.length} item${selectedItemIds.length !== 1 ? 's' : ''} selected`}
                        </p>
                      </div>
                      <button onClick={closeItemsPanel} className="p-1 rounded text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {loadingItems ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
                      </div>
                    ) : allCatalogItems.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">No catalog items yet. Add items in the Catalog section first.</p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {allCatalogItems.map(item => {
                          const isSelected = selectedItemIds.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleItemSelection(item.id)}
                              className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
                                isSelected
                                  ? 'border-[#00352F] shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300 opacity-60 hover:opacity-100'
                              } ${!item.is_active ? 'opacity-40' : ''}`}
                            >
                              <div className="aspect-square bg-gray-50 relative">
                                {item.image_url ? (
                                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Shirt className="w-8 h-8 text-gray-300" />
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: '#00352F' }}>
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div className="p-1.5">
                                <p className="text-[11px] font-medium text-gray-800 truncate leading-tight">{item.name}</p>
                                {!item.is_active && <p className="text-[10px] text-gray-400">Hidden</p>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => handleSaveItems(campaign.id)}
                        disabled={savingItems || loadingItems}
                        className="text-white text-xs"
                        style={{ backgroundColor: '#00352F' }}
                      >
                        {savingItems ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</> : 'Save Items'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={closeItemsPanel} className="text-xs">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
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
