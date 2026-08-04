/**
 * @file page.tsx
 * @description Admin municipios management. Lists all municipios (active + inactive),
 * lets the admin add new ones, toggle visibility in the order-form dropdown, and
 * delete. The public order form only shows active municipios (via /api/municipalities).
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSettings permission.
 */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Landmark, Plus, Trash2, Search } from 'lucide-react'
import { useT } from '@/contexts/LanguageContext'
import type { Municipality } from '@/types'

export default function MunicipalitiesPage() {
  const t = useT()
  const [municipios, setMunicipios] = useState<Municipality[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/municipalities')
      .then(r => r.json())
      .then(({ municipalities }) => setMunicipios(municipalities || []))
      .catch(() => toast.error('Failed to load municipios'))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/municipalities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to add'); return }
      setMunicipios(prev => [...prev, json.municipality].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`"${json.municipality.name}" added`)
      setNewName('')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (m: Municipality) => {
    setBusyId(m.id)
    try {
      const res = await fetch(`/api/admin/municipalities/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !m.is_active }),
      })
      if (!res.ok) { toast.error('Failed to update'); return }
      setMunicipios(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !m.is_active } : x))
    } catch {
      toast.error('Failed to update')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (m: Municipality) => {
    if (!confirm(`Remove "${m.name}"? Existing orders keep their municipio name.`)) return
    setBusyId(m.id)
    try {
      const res = await fetch(`/api/admin/municipalities/${m.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete'); return }
      setMunicipios(prev => prev.filter(x => x.id !== m.id))
      toast.success(`"${m.name}" removed`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = municipios.filter(m => m.is_active).length
  const shown = municipios.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()))

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-40" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Landmark className="w-6 h-6 text-[#00352F]" /> {t('admin', 'municipiosTitle')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{t('admin', 'municipiosSubtitle')}</p>
      </div>

      <div className="flex gap-3">
        {[
          { label: 'Total', value: municipios.length, color: 'text-gray-900' },
          { label: 'Activos', value: activeCount, color: 'text-[#00352F]' },
          { label: 'Ocultos', value: municipios.length - activeCount, color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white border rounded-xl px-4 py-3 text-center min-w-[90px]">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={t('admin', 'municipioNamePlaceholder')}
          className="max-w-xs"
          disabled={adding}
        />
        <Button type="submit" disabled={adding || !newName.trim()} className="text-white" style={{ backgroundColor: '#00352F' }}>
          <Plus className="w-4 h-4 mr-1" /> {t('admin', 'addMunicipio')}
        </Button>
      </form>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9" />
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0 divide-y divide-gray-100">
          {shown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">—</p>
          ) : shown.map(m => (
            <div key={m.id} className={`flex items-center gap-3 px-4 py-2.5 ${!m.is_active ? 'opacity-50' : ''}`}>
              <span className="text-sm font-medium text-gray-900">{m.name}</span>
              <div className="ml-auto flex items-center gap-3">
                <Switch
                  checked={m.is_active}
                  disabled={busyId === m.id}
                  onCheckedChange={() => handleToggle(m)}
                />
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => handleDelete(m)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
