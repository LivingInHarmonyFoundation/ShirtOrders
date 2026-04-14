'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Trash2, Eye, EyeOff, Briefcase, Pencil, Check, X } from 'lucide-react'
import type { PrivateCompany } from '@/types'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<PrivateCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/admin/private-companies')
      const json = await res.json()
      setCompanies(json.companies || [])
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/admin/private-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to add company'); return }
      setCompanies(prev => [...prev, json.company].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      toast.success(`"${json.company.name}" added`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (company: PrivateCompany) => {
    setEditingId(company.id)
    setEditName(company.name)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const handleSaveName = async (company: PrivateCompany) => {
    if (!editName.trim() || editName.trim() === company.name) { cancelEdit(); return }
    setSavingId(company.id)
    try {
      const res = await fetch(`/api/admin/private-companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to update'); return }
      setCompanies(prev => prev.map(c => c.id === company.id ? json.company : c).sort((a, b) => a.name.localeCompare(b.name)))
      cancelEdit()
      toast.success('Company renamed')
    } catch {
      toast.error('Failed to update')
    } finally {
      setSavingId(null)
    }
  }

  const handleToggle = async (company: PrivateCompany) => {
    setTogglingId(company.id)
    try {
      const res = await fetch(`/api/admin/private-companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !company.is_active }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to update'); return }
      setCompanies(prev => prev.map(c => c.id === company.id ? json.company : c))
      toast.success(company.is_active ? 'Hidden from order form' : 'Visible in order form')
    } catch {
      toast.error('Failed to update')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (company: PrivateCompany) => {
    if (!confirm(`Remove "${company.name}"? This cannot be undone.`)) return
    setDeletingId(company.id)
    try {
      const res = await fetch(`/api/admin/private-companies/${company.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete'); return }
      setCompanies(prev => prev.filter(c => c.id !== company.id))
      toast.success(`"${company.name}" removed`)
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const activeCount = companies.filter(c => c.is_active).length

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Private Companies</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage the companies available in the private company order dropdown
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-[#1B4D2E]">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-400">{companies.length - activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hidden</p>
        </div>
      </div>

      {/* Add form */}
      <Card className="border-[#8DC63F]/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#1B4D2E]" /> Add Company
          </CardTitle>
          <CardDescription>Add a new private company to the dropdown list</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <Input
              placeholder="e.g. Acme Corporation"
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
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-900">No companies yet</p>
            <p className="text-gray-500 text-sm mt-1">Add your first company above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {companies.map(company => (
            <div
              key={company.id}
              className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${!company.is_active ? 'opacity-60' : ''}`}
            >
              <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {editingId === company.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName(company); if (e.key === 'Escape') cancelEdit() }}
                  className="flex-1 text-sm border border-[#8DC63F] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#1B4D2E]/20"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-gray-800">{company.name}</span>
              )}

              {!company.is_active && <Badge variant="outline" className="text-xs text-gray-400">Hidden</Badge>}

              <div className="flex gap-1 flex-shrink-0">
                {editingId === company.id ? (
                  <>
                    <button
                      onClick={() => handleSaveName(company)}
                      disabled={savingId === company.id}
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
                      onClick={() => startEdit(company)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(company)}
                      disabled={togglingId === company.id}
                      className={`p-1.5 rounded-lg transition-colors ${company.is_active ? 'text-[#1B4D2E] hover:bg-[#EFF8E8]' : 'text-gray-400 hover:bg-gray-100'}`}
                      title={company.is_active ? 'Hide from order form' : 'Show in order form'}
                    >
                      {company.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(company)}
                      disabled={deletingId === company.id}
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
