'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { School, Building2, ArrowRight, Loader2, CheckCircle2, ShoppingBag } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import type { AppSettings, InstitutionType, ShirtSize, ShirtCatalogItem, GovOrg } from '@/types'

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  institution_type: z.enum(['school', 'government'] as const),
  school_name: z.string().optional(),
  grade: z.string().optional(),
  classroom: z.string().optional(),
  organization_name: z.string().optional(),
  department_office: z.string().optional(),
  shirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.institution_type === 'school') {
    if (!data.school_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'School name is required', path: ['school_name'] })
    if (!data.grade) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Grade is required', path: ['grade'] })
    if (!data.classroom) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Classroom is required', path: ['classroom'] })
  }
  if (data.institution_type === 'government') {
    if (!data.organization_name) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Organization name is required', path: ['organization_name'] })
    if (!data.department_office) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Department/Office is required', path: ['department_office'] })
  }
})

type FormData = z.infer<typeof schema>

export default function OrderPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [catalog, setCatalog] = useState<ShirtCatalogItem[]>([])
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ShirtCatalogItem | null>(null)
  const [govOrgs, setGovOrgs] = useState<GovOrg[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [institutionType, setInstitutionType] = useState<InstitutionType | ''>('')

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  })

  const watchedSize = watch('shirt_size')
  const watchedQty = watch('quantity')
  const unitPrice = settings?.shirt_price || 15

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => { if (settings) setSettings(settings) })
      .catch(() => {})

    fetch('/api/catalog')
      .then(r => r.json())
      .then(({ items }) => {
        if (items?.length > 0) setCatalog(items)
      })
      .catch(() => {})

    fetch('/api/government-orgs')
      .then(r => r.json())
      .then(({ orgs }) => { if (orgs?.length > 0) setGovOrgs(orgs) })
      .catch(() => {})
  }, [])

  // Auto-select if only one shirt
  useEffect(() => {
    if (catalog.length === 1) setSelectedCatalogItem(catalog[0])
  }, [catalog])

  const onSubmit = async (data: FormData) => {
    if (catalog.length > 1 && !selectedCatalogItem) {
      toast.error('Please select a shirt style before continuing')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          quantity: Number(data.quantity),
          catalog_item_id: selectedCatalogItem?.id || null,
          catalog_item_name: selectedCatalogItem?.name || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Failed to submit order'); return }
      router.push(`/order/checkout?order_id=${json.order.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const sizes: ShirtSize[] = settings?.available_sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const showCatalogPicker = catalog.length > 1

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Header */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
              <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
            </div>
            <div>
              <p className="font-bold text-[#1B4D2E] text-sm leading-none">Living in Harmony Foundation</p>
              <p className="text-gray-400 text-xs mt-0.5">Shirt Order Manager</p>
            </div>
          </div>
          <Link href="/" className="text-xs text-gray-400 hover:text-[#1B4D2E] transition-colors">← Back</Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Place Your Order</h1>
          <p className="text-gray-500 mt-1 text-sm">Fill out the form below to order your shirts</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Shirt Style Picker — only shown when multiple options exist */}
          {showCatalogPicker && (
            <Card className={cn('border-2 transition-colors', !selectedCatalogItem ? 'border-amber-300 bg-amber-50' : 'border-[#8DC63F]/40')}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Choose Your Shirt *</CardTitle>
                <CardDescription>Select the shirt style you want to order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {catalog.map(item => {
                    const selected = selectedCatalogItem?.id === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCatalogItem(item)}
                        className={cn(
                          'relative rounded-xl border-2 overflow-hidden text-left transition-all focus:outline-none',
                          selected
                            ? 'border-[#1B4D2E] shadow-md ring-2 ring-[#1B4D2E]/20'
                            : 'border-gray-200 hover:border-[#1B4D2E]/40'
                        )}
                      >
                        {/* Image */}
                        <div className="relative aspect-square bg-[#EFF8E8]">
                          {item.image_url ? (
                            <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ShoppingBag className="w-8 h-8 text-[#8DC63F]/50" />
                            </div>
                          )}
                          {selected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-[#1B4D2E] rounded-full flex items-center justify-center shadow">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className={cn('p-2.5', selected ? 'bg-[#EFF8E8]' : 'bg-white')}>
                          <p className={cn('text-xs font-semibold leading-tight', selected ? 'text-[#1B4D2E]' : 'text-gray-800')}>
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {!selectedCatalogItem && (
                  <p className="text-amber-600 text-xs mt-3 font-medium">Please select a shirt style to continue</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Institution Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Institution Type</CardTitle>
              <CardDescription>Select your institution type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'school' as const, label: 'School', icon: School, enabled: settings?.school_orders_enabled !== false },
                  { value: 'government' as const, label: 'Government', icon: Building2, enabled: settings?.government_orders_enabled !== false },
                ].map(({ value, label, icon: Icon, enabled }) => (
                  <button
                    key={value}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      setInstitutionType(value)
                      setValue('institution_type', value, { shouldValidate: true })
                    }}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-sm font-medium',
                      institutionType === value
                        ? 'border-[#1B4D2E] bg-[#EFF8E8] text-[#1B4D2E]'
                        : 'border-gray-200 hover:border-[#1B4D2E]/30 text-gray-700',
                      !enabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>
              {errors.institution_type && (
                <p className="text-red-500 text-xs mt-2">{errors.institution_type.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input id="full_name" {...register('full_name')} placeholder="Juan dela Cruz" className="mt-1" />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="juan@example.com" className="mt-1" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Phone <span className="text-gray-400">(optional)</span></Label>
                  <Input id="phone" type="tel" {...register('phone')} placeholder="+1 (555) 000-0000" className="mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* School fields */}
          {institutionType === 'school' && (
            <Card>
              <CardHeader><CardTitle className="text-base">School Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="school_name">School Name *</Label>
                  <Input id="school_name" {...register('school_name')} placeholder="Rizal Elementary School" className="mt-1" />
                  {errors.school_name && <p className="text-red-500 text-xs mt-1">{errors.school_name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="grade">Grade *</Label>
                    <Input id="grade" {...register('grade')} placeholder="Grade 5" className="mt-1" />
                    {errors.grade && <p className="text-red-500 text-xs mt-1">{errors.grade.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="classroom">Classroom *</Label>
                    <Input id="classroom" {...register('classroom')} placeholder="Room 101" className="mt-1" />
                    {errors.classroom && <p className="text-red-500 text-xs mt-1">{errors.classroom.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Government fields */}
          {institutionType === 'government' && (
            <Card>
              <CardHeader><CardTitle className="text-base">Organization Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="organization_name">Organization Name *</Label>
                  {govOrgs.length > 0 ? (
                    <select
                      id="organization_name"
                      {...register('organization_name')}
                      className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">Select an organization...</option>
                      {govOrgs.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                      ))}
                    </select>
                  ) : (
                    <Input id="organization_name" {...register('organization_name')} placeholder="Department of Education" className="mt-1" />
                  )}
                  {errors.organization_name && <p className="text-red-500 text-xs mt-1">{errors.organization_name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="department_office">Department / Office *</Label>
                  <Input id="department_office" {...register('department_office')} placeholder="IT Department" className="mt-1" />
                  {errors.department_office && <p className="text-red-500 text-xs mt-1">{errors.department_office.message}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shirt Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shirt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show selected shirt summary if only 1 in catalog */}
              {catalog.length === 1 && selectedCatalogItem && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#EFF8E8] border border-[#8DC63F]/30">
                  {selectedCatalogItem.image_url ? (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <Image src={selectedCatalogItem.image_url} alt={selectedCatalogItem.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-[#8DC63F]" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Selected shirt</p>
                    <p className="font-semibold text-[#1B4D2E] text-sm">{selectedCatalogItem.name}</p>
                  </div>
                </div>
              )}

              <div>
                <Label>Shirt Size *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sizes.map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setValue('shirt_size', size, { shouldValidate: true })}
                      className={cn(
                        'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                        watchedSize === size
                          ? 'border-[#1B4D2E] bg-[#EFF8E8] text-[#1B4D2E]'
                          : 'border-gray-200 hover:border-[#1B4D2E]/30 text-gray-700'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {errors.shirt_size && <p className="text-red-500 text-xs mt-1">{errors.shirt_size.message}</p>}
              </div>

              <div>
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="999"
                  {...register('quantity', { valueAsNumber: true })}
                  className="mt-1 max-w-[140px]"
                />
                {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity.message}</p>}
              </div>

              <div>
                <Label htmlFor="notes">Notes <span className="text-gray-400">(optional)</span></Label>
                <Textarea id="notes" {...register('notes')} placeholder="Any special requests or notes..." className="mt-1" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          {watchedSize && watchedQty > 0 && (
            <Card className="border-[#8DC63F]/40 bg-[#EFF8E8]">
              <CardContent className="p-4">
                <h3 className="font-semibold text-[#1B4D2E] mb-3">Order Summary</h3>
                <div className="space-y-1 text-sm">
                  {selectedCatalogItem && (
                    <div className="flex justify-between text-gray-600">
                      <span>Style</span>
                      <span className="font-medium text-gray-800">{selectedCatalogItem.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Size {watchedSize} × {watchedQty}</span>
                    <span>{formatCurrency(unitPrice)} each</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-[#1B4D2E]">{formatCurrency(unitPrice * (watchedQty || 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || !institutionType || (showCatalogPicker && !selectedCatalogItem)}
            className="w-full text-white h-12 text-base font-semibold"
            style={{ backgroundColor: '#1B4D2E' }}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              <>Continue to Payment <ArrowRight className="w-4 h-4 ml-2" /></>
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}
