'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus, Trash2, Eye, EyeOff, Building2, Pencil, Check, X,
  Settings2, ChevronDown, ChevronUp, Tag
} from 'lucide-react'
import type { GovOrg } from '@/types'

const PAYMENT_METHODS = ['paypal', 'venmo', 'card', 'cash'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

const METHOD_LABELS: Record<PaymentMethod, string> = {
  paypal: 'PayPal',
  venmo: 'Venmo',
  card: 'Card',
  cash: 'Cash',
}

function isMethodEnabled(methods: string[] | null, method: PaymentMethod): boolean {
  if (methods === null) return true
  return methods.includes(method)
}

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

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [expandedPayment, setExpandedPayment] = useState<Set<string>>(new Set())
  const [newDept, setNewDept] = useState<Record<string, string>>({})
  const [savingDeptId, setSavingDeptId] = useState<string | null>(null)
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)

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

  const toggleDeptsExpand = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setExpandedPayment(p => { const np = new Set(p); np.delete(id); return np })
      }
      return next
    })
  }

  const togglePaymentExpand = (id: string) => {
    setExpandedPayment(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else {
        next.add(id)
        setExpandedDepts(p => { const np = new Set(p); np.delete(id); return np })
      }
      return next
    })
  }

  const handleAddDept = async (org: GovOrg) => {
    const dept = (newDept[org.id] || '').trim()
    if (!dept) return
    const updated = [...(org.departments || []), dept]
    setSavingDeptId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: updated }),
      })
      if (!res.ok) throw new Error()
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, departments: updated } : o))
      setNewDept(prev => ({ ...prev, [org.id]: '' }))
    } catch {
      toast.error('Failed to add department')
    } finally {
      setSavingDeptId(null)
    }
  }

  const handleRemoveDept = async (org: GovOrg, dept: string) => {
    const updated = (org.departments || []).filter(d => d !== dept)
    setSavingDeptId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: updated }),
      })
      if (!res.ok) throw new Error()
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, departments: updated } : o))
    } catch {
      toast.error('Failed to remove department')
    } finally {
      setSavingDeptId(null)
    }
  }

  const handlePaymentToggle = async (org: GovOrg, method: PaymentMethod) => {
    const current = org.allowed_payment_methods
    const currentEnabled = isMethodEnabled(current, method)

    let updated: string[] | null
    if (current === null) {
      updated = PAYMENT_METHODS.filter(m => m !== method)
    } else {
      if (currentEnabled) {
        updated = current.filter(m => m !== method)
      } else {
        updated = [...current, method]
      }
    }

    if (updated !== null && updated.length === PAYMENT_METHODS.length) {
      updated = null
    }

    setSavingPaymentId(org.id)
    try {
      const res = await fetch(`/api/admin/government-orgs/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_payment_methods: updated }),
      })
      if (!res.ok) throw new Error()
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, allowed_payment_methods: updated } : o))
    } catch {
      toast.error('Failed to update payment methods')
    } finally {
      setSavingPaymentId(null)
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
          <p className="text-2xl font-bold text-[#00352F]">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </div>
        <div className="bg-white border rounded-xl px-4 py-3 text-center min-w-[100px]">
          <p className="text-2xl font-bold text-gray-400">{orgs.length - activeCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hidden</p>
        </div>
      </div>

      {/* Add form */}
      <Card className="border-[#CEDC00]/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#00352F]" /> Add Organization
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
              style={{ backgroundColor: '#00352F' }}
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
          {orgs.map(org => {
            const deptsOpen = expandedDepts.has(org.id)
            const paymentOpen = expandedPayment.has(org.id)
            return (
              <div
                key={org.id}
                className={`bg-white border rounded-xl transition-opacity ${!org.is_active ? 'opacity-60' : ''}`}
              >
                {/* Main row */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />

                  {editingId === org.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(org); if (e.key === 'Escape') cancelEdit() }}
                      className="flex-1 text-sm border border-[#CEDC00] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#00352F]/20"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium text-gray-800">{org.name}</span>
                  )}

                  {!org.is_active && <Badge variant="outline" className="text-xs text-gray-400">Hidden</Badge>}

                  {/* Expand buttons */}
                  {editingId !== org.id && (
                    <div className="flex gap-1 mr-1">
                      <button
                        onClick={() => toggleDeptsExpand(org.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${deptsOpen ? 'bg-[#E5F2F0] text-[#00352F]' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                        title="Manage departments"
                      >
                        <Tag className="w-3 h-3" />
                        Departments
                        {deptsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => togglePaymentExpand(org.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${paymentOpen ? 'bg-[#E5F2F0] text-[#00352F]' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}
                        title="Payment settings"
                      >
                        <Settings2 className="w-3 h-3" />
                        Payment
                        {paymentOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  )}

                  <div className="flex gap-1 flex-shrink-0">
                    {editingId === org.id ? (
                      <>
                        <button
                          onClick={() => handleSaveName(org)}
                          disabled={savingId === org.id}
                          className="p-1.5 rounded-lg text-[#00352F] hover:bg-[#E5F2F0] transition-colors"
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
                          className={`p-1.5 rounded-lg transition-colors ${org.is_active ? 'text-[#00352F] hover:bg-[#E5F2F0]' : 'text-gray-400 hover:bg-gray-100'}`}
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

                {/* Departments expandable */}
                {deptsOpen && (
                  <div className="px-4 pb-3 border-t border-gray-50">
                    <div className="pt-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Departments</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(org.departments || []).length === 0 ? (
                          <p className="text-xs text-gray-400">No departments added yet</p>
                        ) : (
                          (org.departments || []).map(dept => (
                            <span
                              key={dept}
                              className="flex items-center gap-1 px-2.5 py-1 bg-[#E5F2F0] text-[#00352F] text-xs font-medium rounded-full"
                            >
                              {dept}
                              <button
                                type="button"
                                disabled={savingDeptId === org.id}
                                onClick={() => handleRemoveDept(org, dept)}
                                className="ml-0.5 text-[#00352F]/60 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="New department name..."
                          value={newDept[org.id] || ''}
                          onChange={e => setNewDept(prev => ({ ...prev, [org.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDept(org) } }}
                          className="flex-1 h-8 text-sm"
                          disabled={savingDeptId === org.id}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddDept(org)}
                          disabled={savingDeptId === org.id || !(newDept[org.id] || '').trim()}
                          className="text-white h-8"
                          style={{ backgroundColor: '#00352F' }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Settings expandable */}
                {paymentOpen && (
                  <div className="px-4 pb-3 border-t border-gray-50">
                    <div className="pt-3">
                      <p className="text-xs font-medium text-gray-600 mb-2">Allowed Payment Methods</p>
                      <div className="flex gap-2 flex-wrap">
                        {PAYMENT_METHODS.map(method => {
                          const enabled = isMethodEnabled(org.allowed_payment_methods, method)
                          return (
                            <button
                              key={method}
                              type="button"
                              disabled={savingPaymentId === org.id}
                              onClick={() => handlePaymentToggle(org, method)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                enabled
                                  ? 'bg-[#00352F] text-white border-[#00352F]'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                              } disabled:opacity-50`}
                            >
                              {enabled && <span className="mr-1">✓</span>}
                              {METHOD_LABELS[method]}
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        {org.allowed_payment_methods === null
                          ? 'All methods enabled (default)'
                          : org.allowed_payment_methods.length === 0
                            ? 'No payment methods allowed'
                            : `${org.allowed_payment_methods.length} method${org.allowed_payment_methods.length === 1 ? '' : 's'} enabled`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
