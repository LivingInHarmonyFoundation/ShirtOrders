/**
 * @file page.tsx
 * @description Admin school link management. Each school gets a unique slug-based URL
 * (/order/[slug]) that pre-fills the institution type and school name on the order form.
 * Admins can copy and share these links with teachers or parents.
 *
 * Per-school configuration:
 * - Grades: array of grade labels shown as a dropdown on the order form; if empty,
 *   the grade field becomes a free-text input.
 * - Payment methods: per-school override of allowed methods (null = all enabled).
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSchools permission.
 */
'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  GraduationCap, Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight,
  ExternalLink, Link2, Users, Settings2, ChevronDown, ChevronUp, Tag, X
} from 'lucide-react'
import type { SchoolLink } from '@/types'

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

/**
 * SchoolsPage — CRUD for school links with per-school grade and payment-method settings.
 * Grades and payment settings each have their own collapsible section per row;
 * expanding one collapses the other to keep the UI manageable.
 */
export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolLink[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newSchoolName, setNewSchoolName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set())
  const [expandedPayment, setExpandedPayment] = useState<Set<string>>(new Set())
  const [newGrade, setNewGrade] = useState<Record<string, string>>({})
  const [savingGradeId, setSavingGradeId] = useState<string | null>(null)
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/admin/schools')
      const json = await res.json()
      if (json.schools) setSchools(json.schools)
    } catch {
      toast.error('Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchools() }, [])

  const getLink = (slug: string) => `${window.location.origin}/order/${slug}`

  const handleCopy = async (school: SchoolLink) => {
    try {
      await navigator.clipboard.writeText(getLink(school.slug))
      setCopiedId(school.id)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleToggle = async (school: SchoolLink) => {
    setTogglingId(school.id)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !school.is_active }),
      })
      if (!res.ok) throw new Error()
      toast.success(`School link ${school.is_active ? 'deactivated' : 'activated'}`)
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, is_active: !s.is_active } : s))
    } catch {
      toast.error('Failed to update school')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (school: SchoolLink) => {
    if (!confirm(`Delete "${school.school_name}"? This cannot be undone.`)) return
    setDeletingId(school.id)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('School deleted')
      setSchools(prev => prev.filter(s => s.id !== school.id))
    } catch {
      toast.error('Failed to delete school')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSchoolName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_name: newSchoolName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to create school')
        return
      }
      toast.success(`School link created for "${json.school.school_name}"`)
      setSchools(prev => [{ ...json.school, order_count: 0 }, ...prev])
      setNewSchoolName('')
      setAdding(false)
    } catch {
      toast.error('Failed to create school')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleGradesExpand = (id: string) => {
    setExpandedGrades(prev => {
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
        setExpandedGrades(p => { const np = new Set(p); np.delete(id); return np })
      }
      return next
    })
  }

  const handleAddGrade = async (school: SchoolLink) => {
    const grade = (newGrade[school.id] || '').trim()
    if (!grade) return
    const updated = [...(school.grades || []), grade]
    setSavingGradeId(school.id)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: updated }),
      })
      if (!res.ok) throw new Error()
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, grades: updated } : s))
      setNewGrade(prev => ({ ...prev, [school.id]: '' }))
    } catch {
      toast.error('Failed to add grade')
    } finally {
      setSavingGradeId(null)
    }
  }

  const handleRemoveGrade = async (school: SchoolLink, grade: string) => {
    const updated = (school.grades || []).filter(g => g !== grade)
    setSavingGradeId(school.id)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: updated }),
      })
      if (!res.ok) throw new Error()
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, grades: updated } : s))
    } catch {
      toast.error('Failed to remove grade')
    } finally {
      setSavingGradeId(null)
    }
  }

  const handlePaymentToggle = async (school: SchoolLink, method: PaymentMethod) => {
    const current = school.allowed_payment_methods
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

    setSavingPaymentId(school.id)
    try {
      const res = await fetch(`/api/admin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_payment_methods: updated }),
      })
      if (!res.ok) throw new Error()
      setSchools(prev => prev.map(s => s.id === school.id ? { ...s, allowed_payment_methods: updated } : s))
    } catch {
      toast.error('Failed to update payment methods')
    } finally {
      setSavingPaymentId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schools</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Generate unique order links for each school
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} className="text-white" style={{ backgroundColor: '#00352F' }}>
            <Plus className="w-4 h-4 mr-2" /> Add School
          </Button>
        )}
      </div>

      {/* Add school form */}
      {adding && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              New School Link
            </CardTitle>
            <CardDescription>Enter the school name to generate a unique shareable order link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex gap-3">
              <Input
                autoFocus
                placeholder="e.g. Rizal Elementary School"
                value={newSchoolName}
                onChange={e => setNewSchoolName(e.target.value)}
                className="flex-1"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newSchoolName.trim()} className="text-white" style={{ backgroundColor: '#00352F' }}>
                {submitting ? 'Creating...' : 'Create Link'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setAdding(false); setNewSchoolName('') }} disabled={submitting}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Schools list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : schools.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white">No schools yet</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a school to generate a unique order link.</p>
            <Button onClick={() => setAdding(true)} className="mt-4 text-white" style={{ backgroundColor: '#00352F' }}>
              <Plus className="w-4 h-4 mr-2" /> Add First School
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schools.map(school => {
            const gradesOpen = expandedGrades.has(school.id)
            const paymentOpen = expandedPayment.has(school.id)
            return (
              <Card key={school.id} className={!school.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${school.is_active ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <GraduationCap className={`w-5 h-5 ${school.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">{school.school_name}</span>
                        <Badge variant={school.is_active ? 'default' : 'secondary'} className={school.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                          {school.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {(school.order_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Users className="w-3 h-3" />
                            {school.order_count} {school.order_count === 1 ? 'order' : 'orders'}
                          </span>
                        )}
                      </div>
                      {/* Link display */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">/order/{school.slug}</span>
                      </div>
                      {/* Created date */}
                      <p className="text-xs text-gray-400 mt-1">
                        Created {new Date(school.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>

                      {/* Expand buttons */}
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleGradesExpand(school.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${gradesOpen ? 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40' : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Grades
                          {(school.grades || []).length > 0 && (
                            <span className="bg-[#CEDC00]/30 text-[#00352F] px-1.5 rounded-full text-[10px] font-bold">
                              {(school.grades || []).length}
                            </span>
                          )}
                          {gradesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePaymentExpand(school.id)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${paymentOpen ? 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40' : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Payment Settings
                          {paymentOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Grades expandable */}
                      {gradesOpen && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Grades</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {(school.grades || []).length === 0 ? (
                              <p className="text-xs text-gray-400">No grades added yet — grade field will be a text input</p>
                            ) : (
                              (school.grades || []).map(grade => (
                                <span
                                  key={grade}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-[#E5F2F0] text-[#00352F] text-xs font-medium rounded-full"
                                >
                                  {grade}
                                  <button
                                    type="button"
                                    disabled={savingGradeId === school.id}
                                    onClick={() => handleRemoveGrade(school, grade)}
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
                              placeholder="e.g. Grade 5"
                              value={newGrade[school.id] || ''}
                              onChange={e => setNewGrade(prev => ({ ...prev, [school.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddGrade(school) } }}
                              className="flex-1 h-8 text-sm"
                              disabled={savingGradeId === school.id}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddGrade(school)}
                              disabled={savingGradeId === school.id || !(newGrade[school.id] || '').trim()}
                              className="text-white h-8"
                              style={{ backgroundColor: '#00352F' }}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Payment Settings expandable */}
                      {paymentOpen && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-700">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Allowed Payment Methods</p>
                          <div className="flex gap-2 flex-wrap">
                            {PAYMENT_METHODS.map(method => {
                              const enabled = isMethodEnabled(school.allowed_payment_methods, method)
                              return (
                                <button
                                  key={method}
                                  type="button"
                                  disabled={savingPaymentId === school.id}
                                  onClick={() => handlePaymentToggle(school, method)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    enabled
                                      ? 'bg-[#00352F] text-white border-[#00352F]'
                                      : 'bg-white dark:bg-gray-900 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                                  } disabled:opacity-50`}
                                >
                                  {enabled && <span className="mr-1">✓</span>}
                                  {METHOD_LABELS[method]}
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-2">
                            {school.allowed_payment_methods === null
                              ? 'All methods enabled (default)'
                              : school.allowed_payment_methods.length === 0
                                ? 'No payment methods allowed'
                                : `${school.allowed_payment_methods.length} method${school.allowed_payment_methods.length === 1 ? '' : 's'} enabled`}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Copy link */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(school)}
                        className="gap-1.5"
                        disabled={!school.is_active}
                        title={school.is_active ? 'Copy shareable link' : 'Link is inactive'}
                      >
                        {copiedId === school.id ? (
                          <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                        )}
                      </Button>

                      {/* Open link */}
                      {school.is_active && (
                        <a
                          href={`/order/${school.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline" title="Open order form">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}

                      {/* Toggle active */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggle(school)}
                        disabled={togglingId === school.id}
                        title={school.is_active ? 'Deactivate link' : 'Activate link'}
                        className={school.is_active ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                      >
                        {togglingId === school.id ? (
                          <span className="text-xs">...</span>
                        ) : school.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(school)}
                        disabled={deletingId === school.id}
                        title="Delete school"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === school.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info card */}
      {schools.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex gap-3">
            <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Each school link opens an order form pre-filled with the school name and institution type. Share it with teachers or parents so orders are automatically attributed to the correct school.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
