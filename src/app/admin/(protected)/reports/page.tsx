'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileText, Printer, Filter, Shirt, Megaphone } from 'lucide-react'
import { PaymentStatusBadge, OrderStatusBadge, DeliveryStatusBadge, InstitutionBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Order, DashboardStats, GovOrg, SchoolLink, PrivateCompany, Campaign } from '@/types'
import { toast } from 'sonner'

// Color cycle for the catalog style cards
const CATALOG_COLORS = ['#00352F', '#00594F', '#CEDC00', '#00594F', '#00352F']

export default function ReportsPage() {
  // ── State ──
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [catalogBreakdown, setCatalogBreakdown] = useState<DashboardStats['orders_by_catalog_item']>([])
  const [hasCatalog, setHasCatalog] = useState(false)

  // Filters
  const [institutionType, setInstitutionType] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [deliveryStatus, setDeliveryStatus] = useState('')
  const [shirtSize, setShirtSize] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [grade, setGrade] = useState('')
  const [classroom, setClassroom] = useState('')
  const [department, setDepartment] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [campaignId, setCampaignId] = useState('')

  // Sub-filter dropdown lists (loaded once)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [govOrgs, setGovOrgs] = useState<GovOrg[]>([])
  const [schools, setSchools] = useState<SchoolLink[]>([])
  const [companies, setCompanies] = useState<PrivateCompany[]>([])

  // ── Effects ──

  // Load filter dropdown options on mount
  useEffect(() => {
    fetch('/api/admin/campaigns')
      .then(r => r.json()).then(j => setCampaigns(j.campaigns || [])).catch(() => {})
    fetch('/api/admin/government-orgs')
      .then(r => r.json()).then(j => setGovOrgs(j.orgs || [])).catch(() => {})
    fetch('/api/admin/schools')
      .then(r => r.json()).then(j => setSchools(j.schools || [])).catch(() => {})
    fetch('/api/admin/private-companies')
      .then(r => r.json()).then(j => setCompanies(j.companies || [])).catch(() => {})
  }, [])

  const buildExportUrl = () => {
    const params = new URLSearchParams()
    if (institutionType) params.set('institution_type', institutionType)
    if (paymentStatus) params.set('payment_status', paymentStatus)
    if (deliveryStatus) params.set('delivery_status', deliveryStatus)
    if (shirtSize) params.set('shirt_size', shirtSize)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    if (grade) params.set('grade', grade)
    if (classroom) params.set('classroom', classroom)
    if (department) params.set('department', department)
    if (organizationName) params.set('organization_name', organizationName)
    if (schoolName) params.set('school_name', schoolName)
    if (companyName) params.set('company_name', companyName)
    if (campaignId) params.set('campaign_id', campaignId)
    return `/api/admin/export?${params}`
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        institution_type: institutionType, payment_status: paymentStatus,
        delivery_status: deliveryStatus, shirt_size: shirtSize,
        date_from: dateFrom, date_to: dateTo,
        grade, classroom, department,
        organization_name: organizationName,
        school_name: schoolName,
        company_name: companyName,
        campaign_id: campaignId,
        limit: '500',
      })
      const res = await fetch(`/api/admin/orders?${params}`)
      const json = await res.json()
      const orderList: Order[] = json.orders || []
      setOrders(orderList)
      setTotalRevenue(
        orderList
          .filter(o => o.payment_status === 'paid' || o.payment_status === 'manual')
          .reduce((sum, o) => sum + Number(o.total_amount), 0)
      )
      // Build catalog breakdown from this filtered set
      const cmap = new Map<string, { orders: number; shirts: number }>()
      orderList.forEach((o: Order) => {
        const name = o.catalog_item_name || null
        if (!name) return
        const ex = cmap.get(name) || { orders: 0, shirts: 0 }
        cmap.set(name, { orders: ex.orders + 1, shirts: ex.shirts + o.quantity })
      })
      const breakdown = Array.from(cmap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.shirts - a.shirts)
      setCatalogBreakdown(breakdown)
      setHasCatalog(breakdown.length > 0)
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  // Run report with default (no) filters on first load
  useEffect(() => { fetchReport() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──

  const handleExport = () => {
    window.open(buildExportUrl(), '_blank')
    toast.success('CSV download started')
  }

  const handlePrint = () => window.print()

  // ── Render ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Exports</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Filter and export order data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <Button onClick={handleExport} size="sm" className="text-white" style={{ backgroundColor: '#00352F' }}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h1 className="text-xl font-bold">Institution Shirt Order Manager — Report</h1>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString()}</p>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter Report
          </CardTitle>
          <CardDescription className="text-xs">Apply filters then click Generate Report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {campaigns.length > 0 && (
              <div>
                <Label className="text-xs flex items-center gap-1"><Megaphone className="w-3 h-3" /> Campaign</Label>
                <Select value={campaignId || 'all'} onValueChange={v => setCampaignId(!v || v === 'all' ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="All Campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.is_active ? ' ●' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Institution Type</Label>
              <Select value={institutionType} onValueChange={v => {
                const t = !v || v === 'all' ? '' : v
                setInstitutionType(t)
                setOrganizationName(''); setSchoolName(''); setCompanyName('')
              }}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="government">Gobierno</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="private_company">Private Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sub-filter by specific org/school/company */}
            {institutionType === 'government' && govOrgs.length > 0 && (
              <div>
                <Label className="text-xs">Agency</Label>
                <Select value={organizationName} onValueChange={v => setOrganizationName(!v || v === 'all' ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="All agencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agencies</SelectItem>
                    {govOrgs.filter(o => o.is_active).map(o => (
                      <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {institutionType === 'school' && schools.length > 0 && (
              <div>
                <Label className="text-xs">School</Label>
                <Select value={schoolName} onValueChange={v => setSchoolName(!v || v === 'all' ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="All schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All schools</SelectItem>
                    {schools.map(s => (
                      <SelectItem key={s.id} value={s.school_name}>{s.school_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {institutionType === 'private_company' && companies.length > 0 && (
              <div>
                <Label className="text-xs">Company</Label>
                <Select value={companyName} onValueChange={v => setCompanyName(!v || v === 'all' ? '' : v)}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.filter(c => c.is_active).map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatus} onValueChange={v => setPaymentStatus(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Delivery Status</Label>
              <Select value={deliveryStatus} onValueChange={v => setDeliveryStatus(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not_delivered">Not Delivered</SelectItem>
                  <SelectItem value="partially_delivered">Partial</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Shirt Size</Label>
              <Select value={shirtSize} onValueChange={v => setShirtSize(!v || v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 h-8 text-xs" />
            </div>
          </div>
          {(institutionType === 'school' || !institutionType) && (
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <Label className="text-xs">Grade</Label>
                <Input value={grade} onChange={e => setGrade(e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. 5" />
              </div>
              <div>
                <Label className="text-xs">Classroom</Label>
                <Input value={classroom} onChange={e => setClassroom(e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. 3-A" />
              </div>
            </div>
          )}
          {(institutionType === 'government' || institutionType === 'private_company' || !institutionType) && (
            <div className="mt-1">
              <Label className="text-xs">Department</Label>
              <Input value={department} onChange={e => setDepartment(e.target.value)} className="mt-1 h-8 text-xs" placeholder="e.g. Finance" />
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Button onClick={fetchReport} size="sm" className="text-white" style={{ backgroundColor: '#00352F' }}>
              <FileText className="w-4 h-4 mr-1" /> Generate Report
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setInstitutionType(''); setPaymentStatus(''); setDeliveryStatus('')
              setShirtSize(''); setDateFrom(''); setDateTo('')
              setGrade(''); setClassroom(''); setDepartment('')
              setOrganizationName(''); setSchoolName(''); setCompanyName('')
              setCampaignId('')
            }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Shirts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {orders.reduce((s, o) => s + o.quantity, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Revenue (Paid)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Shirt style breakdown */}
      {hasCatalog && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#E5F2F0] rounded-lg flex items-center justify-center flex-shrink-0">
                <Shirt className="w-4 h-4 text-[#00352F]" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Shirts by Style</CardTitle>
                <CardDescription className="text-xs">Based on current filtered results</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalogBreakdown.map(({ name, orders: o, shirts: s }, i) => (
                <div key={name} className="rounded-xl border p-4 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                    style={{ backgroundColor: CATALOG_COLORS[i % CATALOG_COLORS.length] }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      <span className="font-bold text-[#00352F]">{s}</span> shirts &middot; {o} order{o !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                <TableHead className="text-xs font-semibold pl-4">Order #</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Institution</TableHead>
                <TableHead className="text-xs font-semibold">Shirt Style</TableHead>
                <TableHead className="text-xs font-semibold">Size</TableHead>
                <TableHead className="text-xs font-semibold">Qty</TableHead>
                <TableHead className="text-xs font-semibold">Total</TableHead>
                <TableHead className="text-xs font-semibold">Payment</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Delivery</TableHead>
                <TableHead className="text-xs font-semibold">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-gray-400">
                    No orders match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                orders.map(order => (
                  <TableRow key={order.id} className="text-sm">
                    <TableCell className="font-mono text-xs text-gray-500 pl-4">{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{order.full_name}</p>
                        <p className="text-xs text-gray-400">{order.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <InstitutionBadge type={order.institution_type} />
                        {order.institution_type === 'school' && order.school_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.school_name}</p>
                        )}
                        {order.institution_type === 'school' && (order.grade || order.classroom) && (
                          <p className="text-xs text-gray-400">
                            {[order.grade && `Gr. ${order.grade}`, order.classroom && `Rm. ${order.classroom}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {order.institution_type === 'government' && order.organization_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.organization_name}</p>
                        )}
                        {order.institution_type === 'government' && order.department_office && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.department_office}</p>
                        )}
                        {order.institution_type === 'private_company' && order.company_name && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.company_name}</p>
                        )}
                        {order.institution_type === 'private_company' && order.company_department && (
                          <p className="text-xs text-gray-400 max-w-[130px] truncate">{order.company_department}</p>
                        )}
                        {order.institution_type === 'personal' && order.delivery_address && (
                          <p className="text-xs text-gray-400 max-w-[150px] truncate" title={order.delivery_address}>{order.delivery_address}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-700">
                      {order.catalog_item_name
                        ? <span className="font-medium">{order.catalog_item_name}</span>
                        : <span className="text-gray-300">—</span>}
                    </TableCell>
                    <TableCell className="font-medium">{order.shirt_size}</TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(order.total_amount)}</TableCell>
                    <TableCell><PaymentStatusBadge status={order.payment_status} /></TableCell>
                    <TableCell><OrderStatusBadge status={order.order_status} /></TableCell>
                    <TableCell><DeliveryStatusBadge status={order.delivery_status} /></TableCell>
                    <TableCell className="text-xs text-gray-400">{formatDate(order.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
