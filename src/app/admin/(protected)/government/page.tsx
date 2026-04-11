'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Eye, EyeOff, Building2, Pencil, Check, X } from 'lucide-react'
import type { GovOrg } from '@/types'

export default function GovernmentPage() {
  const [orgs, setOrgs] = useState<GovOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchOrgs = async () => {
    try {
      const res = await fetch('/api/admin/government-orgs')
      const json = await res.json()
      setOrgs(json.orgs || [])
    } catch {
      toast.error('Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchOrgs() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/government-orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to add organization'); return }
      setOrgs(prev => [...prev, json.org].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      toast.success(`"${json.org.name}" added`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (org: GovOrg) => {
    setEditingId(org.id)
    setEditName(org.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleSaveName = async (org: GovOrg) => {
    if (!editName.trim() || editName.trim() === org.name) { cancelEdit(); return }
    setSavingId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to update'); return }
      setOrgs(prev => prev.map(o => o.id === org.id ? json.org : o).sort((a, b) => a.name.localeCompare(b.name)))
      cancelEdit()
      toast.success('Organization renamed')
    } catch {
      toast.error('Failed to update')
    } finally {
      setSavingId(null)
    }
  }

  const handleToggle = async (org: GovOrg) => {
    setTogglingId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !org.is_active }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to update'); return }
      setOrgs(prev => prev.map(o => o.id === org.id ? json.org : o))
      toast.success(org.is_active ? 'Hidden from order form' : 'Visible in order form')
    } catch {
      toast.error('Failed to update')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (org: GovOrg) => {
    if (!confirm(`Remove "${org.name}"? This cannot be undone.`)) return
    setDeletingId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete'); return }
      setOrgs(prev => prev.filter(o => o.id !== org.id))
      toast.success(`"${org.name}" removed`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const activeCount = orgs.filter(o => o.is_active).length

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Government Organizations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage the organizations available in the government order dropdown
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-900">{orgs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-[#1B4D2E]">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-400">{orgs.length - activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hidden</p>
        </div>
      </div>

      {/* Add form */}
      <Card className="border-[#8DC63F]/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#1B4D2E]" /> Add Organization
          </CardTitle>
          <CardDescription>Add a new government organization to the dropdown list</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="e.g. Department of Education"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              disabled={adding}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={adding || !newName.trim()}
              className="text-white"
              style={{ backgroundColor: '#1B4D2E' }}
            >
              {adding ? 'Adding...' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900">No organizations yet</p>
            <p className="text-gray-500 text-sm mt-1">Add your first organization above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orgs.map(org => (
            <div
              key={org.id}
              className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${!org.is_active ? 'opacity-60' : ''}`}
            >
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {editingId === org.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(org); if (e.key === 'Escape') cancelEdit() }}
                  className="flex-1 text-sm border border-[#8DC63F] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#1B4D2E]/20"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-800">{org.name}</span>
              )}

              {!org.is_active && <Badge variant="outline" className="text-xs text-gray-400">Hidden</Badge>}

              <div className="flex gap-1 flex-shrink-0">
                {editingId === org.id ? (
                  <>
                    <button
                      onClick={() => handleSaveName(org)}
                      disabled={savingId === org.id}
                      className="p-1.5 rounded-lg text-[#1B4D2E] hover:bg-[#EFF8E8] transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(org)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(org)}
                      disabled={togglingId === org.id}
                      className={`p-1.5 rounded-lg transition-colors ${org.is_active ? 'text-[#1B4D2E] hover:bg-[#EFF8E8]' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={org.is_active ? 'Hide from order form' : 'Show in order form'}
                    >
                      {org.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(org)}
                      disabled={deletingId === org.id}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
