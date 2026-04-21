/**
 * @file page.tsx
 * @description Admin private company link management. Each company gets a unique
 * slug-based URL (/order/company/[slug]) that pre-fills the company name on the
 * order form. Admins can copy and share these links with employees.
 * Per-company payment method overrides are supported (null = all methods enabled).
 *
 * Auth: provided by the parent (protected) layout. Requires canManageSettings permission.
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
  Briefcase, Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight,
  ExternalLink, Link2, Users, Settings2, ChevronDown, ChevronUp
} from 'lucide-react'
import type { PrivateCompany } from '@/types'

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
 * CompaniesPage — CRUD for private company order links with per-company payment
 * method settings. Mirrors the Schools page structure but without grade management.
 */
export default function CompaniesPage() {
  const [companies, setCompanies] = useState<PrivateCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedPayment, setExpandedPayment] = useState<Set<string>>(new Set())
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null)

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/admin/private-companies')
      const json = await res.json()
      if (json.companies) setCompanies(json.companies)
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCompanies() }, [])

  const getLink = (slug: string) => `${window.location.origin}/order/company/${slug}`

  const handleCopy = async (company: PrivateCompany) => {
    try {
      await navigator.clipboard.writeText(getLink(company.slug))
      setCopiedId(company.id)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Failed to copy link')
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
      if (!res.ok) throw new Error()
      toast.success(`Company link ${company.is_active ? 'deactivated' : 'activated'}`)
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, is_active: !c.is_active } : c))
    } catch {
      toast.error('Failed to update company')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (company: PrivateCompany) => {
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return
    setDeletingId(company.id)
    try {
      const res = await fetch(`/api/admin/private-companies/${company.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Company deleted')
      setCompanies(prev => prev.filter(c => c.id !== company.id))
    } catch {
      toast.error('Failed to delete company')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/private-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to create company')
        return
      }
      toast.success(`Company link created for "${json.company.name}"`)
      setCompanies(prev => [{ ...json.company, order_count: 0 }, ...prev])
      setNewCompanyName('')
      setAdding(false)
    } catch {
      toast.error('Failed to create company')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePaymentExpand = (id: string) => {
    setExpandedPayment(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePaymentToggle = async (company: PrivateCompany, method: PaymentMethod) => {
    const current = company.allowed_payment_methods
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

    setSavingPaymentId(company.id)
    try {
      const res = await fetch(`/api/admin/private-companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_payment_methods: updated }),
      })
      if (!res.ok) throw new Error()
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, allowed_payment_methods: updated } : c))
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Private Companies</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Generate unique order links for each private company
          </p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)} className="text-white" style={{ backgroundColor: '#00352F' }}>
            <Plus className="w-4 h-4 mr-2" /> Add Company
          </Button>
        )}
      </div>

      {/* Add company form */}
      {adding && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              New Company Link
            </CardTitle>
            <CardDescription>Enter the company name to generate a unique shareable order link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex gap-3">
              <Input
                autoFocus
                placeholder="e.g. Acme Corporation"
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                className="flex-1"
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || !newCompanyName.trim()} className="text-white" style={{ backgroundColor: '#00352F' }}>
                {submitting ? 'Creating...' : 'Create Link'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setAdding(false); setNewCompanyName('') }} disabled={submitting}>
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Companies list */}
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
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-900 dark:text-white">No companies yet</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Add a company to generate a unique order link.</p>
            <Button onClick={() => setAdding(true)} className="mt-4 text-white" style={{ backgroundColor: '#00352F' }}>
              <Plus className="w-4 h-4 mr-2" /> Add First Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map(company => {
            const link = typeof window !== 'undefined' ? getLink(company.slug) : `/order/company/${company.slug}`
            const paymentOpen = expandedPayment.has(company.id)
            return (
              <Card key={company.id} className={!company.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${company.is_active ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Briefcase className={`w-5 h-5 ${company.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-white">{company.name}</span>
                        <Badge variant={company.is_active ? 'default' : 'secondary'} className={company.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0' : 'bg-gray-100 text-gray-500 border-0'}>
                          {company.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {(company.order_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Users className="w-3 h-3" />
                            {company.order_count} {company.order_count === 1 ? 'order' : 'orders'}
                          </span>
                        )}
                      </div>
                      {/* Link display */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">/order/company/{company.slug}</span>
                      </div>
                      {/* Created date */}
                      <p className="text-xs text-gray-400 mt-1">
                        Created {new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>

                      {/* Payment Settings expandable */}
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => togglePaymentExpand(company.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#00352F] transition-colors"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Payment Settings
                          {paymentOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {paymentOpen && (
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Allowed Payment Methods</p>
                            <div className="flex gap-2 flex-wrap">
                              {PAYMENT_METHODS.map(method => {
                                const enabled = isMethodEnabled(company.allowed_payment_methods, method)
                                return (
                                  <button
                                    key={method}
                                    type="button"
                                    disabled={savingPaymentId === company.id}
                                    onClick={() => handlePaymentToggle(company, method)}
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
                              {company.allowed_payment_methods === null
                                ? 'All methods enabled (default)'
                                : company.allowed_payment_methods.length === 0
                                  ? 'No payment methods allowed'
                                  : `${company.allowed_payment_methods.length} method${company.allowed_payment_methods.length === 1 ? '' : 's'} enabled`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Copy link */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(company)}
                        className="gap-1.5"
                        disabled={!company.is_active}
                        title={company.is_active ? 'Copy shareable link' : 'Link is inactive'}
                      >
                        {copiedId === company.id ? (
                          <><Check className="w-3.5 h-3.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                        )}
                      </Button>

                      {/* Open link */}
                      {company.is_active && (
                        <a
                          href={`/order/company/${company.slug}`}
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
                        onClick={() => handleToggle(company)}
                        disabled={togglingId === company.id}
                        title={company.is_active ? 'Deactivate link' : 'Activate link'}
                        className={company.is_active ? 'text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                      >
                        {togglingId === company.id ? (
                          <span className="text-xs">...</span>
                        ) : company.is_active ? (
                          <ToggleRight className="w-4 h-4" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Delete */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(company)}
                        disabled={deletingId === company.id}
                        title="Delete company"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        {deletingId === company.id ? (
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
      {companies.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex gap-3">
            <Link2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Each company link opens an order form pre-filled with the company name. Share it with employees so orders are automatically attributed to the correct company.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
