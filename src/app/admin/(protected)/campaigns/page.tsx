/**
 * @file page.tsx
 * @description Admin campaign management. Campaigns gate order creation — only one
 * campaign may be active at a time. When a campaign is activated, the server
 * automatically deactivates all others. The UI reflects this by locally updating all
 * sibling campaigns to is_active=false when an activation succeeds.
 *
 * Campaigns have optional start/end dates; the computed status badge (Draft / Scheduled /
 * Active / Ended) is derived client-side for display purposes only.
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
import { Separator } from '@/components/ui/separator'
import {
  Plus, Pencil, Trash2, Play, Square, Megaphone,
  Calendar, ShoppingBag, X, Check
} from 'lucide-react'
import type { Campaign } from '@/types'
import { useT } from '@/contexts/LanguageContext'

/**
 * getCampaignStatus — derives a display label and Tailwind color string for a campaign
 * based on its is_active flag and start/end dates relative to today's date.
 */
type CampaignStatusKey = 'campaignStatusDraft' | 'campaignStatusEnded' | 'campaignStatusScheduled' | 'campaignStatusActive'

function getCampaignStatus(c: Campaign): { labelKey: CampaignStatusKey; color: string } {
  const today = new Date().toISOString().split('T')[0]
  if (!c.is_active) return { labelKey: 'campaignStatusDraft', color: 'border-gray-300 text-gray-500' }
  if (c.end_date && c.end_date < today) return { labelKey: 'campaignStatusEnded', color: 'bg-gray-100 text-gray-500' }
  if (c.start_date && c.start_date > today) return { labelKey: 'campaignStatusScheduled', color: 'bg-blue-100 text-blue-700' }
  return { labelKey: 'campaignStatusActive', color: 'bg-[#E5F2F0] text-[#00352F]' }
}

const EMPTY_FORM = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  ended_message: 'This campaign has ended. Thank you for your participation.',
}

/**
 * CampaignsPage — manages fundraising campaigns that gate order submission.
 * Only one campaign may be active at a time; activating one deactivates the rest.
 * The active campaign banner reflects whether the campaign is live, ended, or upcoming.
 */
export default function CampaignsPage() {
  const t = useT()
  // ── State ──
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Handlers ──

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/campaigns')
      const json = await res.json()
      setCampaigns(json.campaigns || [])
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCampaigns() }, [])

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
    })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Campaign name is required'); return }
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
      if (!res.ok) { toast.error(json.error || 'Failed to save campaign'); return }
      if (editingId) {
        setCampaigns(prev => prev.map(c => c.id === editingId ? json.campaign : c))
        toast.success('Campaign updated')
      } else {
        setCampaigns(prev => [json.campaign, ...prev])
        toast.success(`"${json.campaign.name}" created`)
      }
      closeForm()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (campaign: Campaign) => {
    setTogglingId(campaign.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !campaign.is_active }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to update'); return }
      // If activating, all others get deactivated
      if (!campaign.is_active) {
        setCampaigns(prev => prev.map(c => ({ ...c, is_active: c.id === campaign.id })))
      } else {
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? json.campaign : c))
      }
      toast.success(campaign.is_active ? 'Campaign deactivated' : `"${campaign.name}" is now active`)
    } catch {
      toast.error('Failed to update')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (campaign: Campaign) => {
    if (!confirm(`Delete "${campaign.name}"? This cannot be undone. Orders linked to this campaign will remain but lose the campaign link.`)) return
    setDeletingId(campaign.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to delete'); return }
      setCampaigns(prev => prev.filter(c => c.id !== campaign.id))
      toast.success(`"${campaign.name}" deleted`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const activeCampaign = campaigns.find(c => c.is_active)

  // ── Render ──

  // Compute banner state ahead of return to avoid an IIFE in JSX
  const today = new Date().toISOString().split('T')[0]
  const activeBannerEnded = activeCampaign?.end_date && activeCampaign.end_date < today
  const activeBannerLive = activeCampaign
    && (!activeCampaign.start_date || activeCampaign.start_date <= today)
    && (!activeCampaign.end_date || activeCampaign.end_date >= today)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin', 'campaignsTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('admin', 'campaignsSubtitle')}
          </p>
        </div>
        <Button onClick={openNew} className="text-white gap-2" style={{ backgroundColor: '#00352F' }}>
          <Plus className="w-4 h-4" /> {t('admin', 'newCampaign')}
        </Button>
      </div>

      {/* Active campaign status banner */}
      {activeCampaign && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3 border"
          style={{
            backgroundColor: activeBannerEnded ? '#FFF7ED' : '#E5F2F0',
            borderColor: activeBannerEnded ? '#FED7AA' : 'rgba(0,53,47,0.2)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: activeBannerEnded ? '#F97316' : '#00352F' }}
          />
          <p className="text-sm font-medium" style={{ color: activeBannerEnded ? '#9A3412' : '#00352F' }}>
            {activeBannerEnded
              ? `"${activeCampaign.name}" ${t('admin', 'campaignHasEnded')}`
              : activeBannerLive
                ? `"${activeCampaign.name}" ${t('admin', 'campaignIsLive')}`
                : `"${activeCampaign.name}" ${t('admin', 'campaignScheduled')} ${activeCampaign.start_date}.`}
          </p>
        </div>
      )}

      {/* New / Edit form */}
      {showForm && (
        <Card className="border-[#CEDC00]/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{editingId ? t('admin', 'editCampaign') : t('admin', 'newCampaign')}</CardTitle>
                <CardDescription>{editingId ? t('admin', 'editCampaignDesc') : t('admin', 'createCampaignDesc')}</CardDescription>
              </div>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="camp-name">{t('admin', 'campaignNameLabel')}</Label>
                <Input
                  id="camp-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('admin', 'campaignNamePlaceholder')}
                  className="mt-1"
                />
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="camp-start">{t('admin', 'startDateLabel')}</Label>
                  <Input
                    id="camp-start"
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="camp-end">{t('admin', 'endDateLabel')}</Label>
                  <Input
                    id="camp-end"
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
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
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving} className="text-white" style={{ backgroundColor: '#00352F' }}>
                  {saving ? t('admin', 'savingCampaign') : editingId ? t('admin', 'saveChanges') : t('admin', 'createCampaign')}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>{t('admin', 'cancelCampaign')}</Button>
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
            const { labelKey, color } = getCampaignStatus(campaign)
            return (
              <div
                key={campaign.id}
                className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-sm ${campaign.is_active ? 'border-[#00352F]/30 shadow-sm' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: campaign.is_active ? '#E5F2F0' : '#F9FAFB' }}
                  >
                    <Megaphone className="w-5 h-5" style={{ color: campaign.is_active ? '#00352F' : '#9CA3AF' }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{campaign.name}</h3>
                      <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0 ${color}`}>
                        {t('admin', labelKey)}
                      </Badge>
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      {(campaign.start_date || campaign.end_date) && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {campaign.start_date || '—'} → {campaign.end_date || '—'}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <ShoppingBag className="w-3 h-3" />
                        {campaign.order_count ?? 0} orders
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
                      title={t('admin', 'editCampaignBtn')}
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
    </div>
  )
}
