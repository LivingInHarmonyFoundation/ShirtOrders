'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { School, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import Image from 'next/image'
import type { AppSettings, ShirtSize } from '@/types'

const schema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  grade: z.string().min(1, 'Grade is required'),
  classroom: z.string().min(1, 'Classroom is required'),
  shirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface SchoolInfo {
  id: string
  school_name: string
  slug: string
  is_active: boolean
}

export default function SchoolOrderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()

  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1 },
  })

  const watchedSize = watch('shirt_size')
  const watchedQty = watch('quantity')
  const unitPrice = settings?.shirt_price || 15

  useEffect(() => {
    Promise.all([
      fetch(`/api/schools/${slug}`).then(r => r.json()),
      fetch('/api/admin/settings').then(r => r.json()),
    ]).then(([schoolData, settingsData]) => {
      if (schoolData.error) {
        setLoadError(schoolData.error)
      } else {
        setSchool(schoolData.school)
      }
      if (settingsData.settings) setSettings(settingsData.settings)
    }).catch(() => {
      setLoadError('Failed to load order form. Please try again.')
    }).finally(() => setLoading(false))
  }, [slug])

  const onSubmit = async (data: FormData) => {
    if (!school) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          quantity: Number(data.quantity),
          institution_type: 'school',
          school_name: school.school_name,
          school_link_id: school.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || 'Failed to submit order')
        return
      }
      router.push(`/order/checkout?order_id=${json.order.id}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const sizes: ShirtSize[] = settings?.available_sizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

  const Header = () => (
    <header className="border-b bg-white shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-0.5 border border-gray-100">
          <Image src="/logo.png" alt="Living in Harmony Foundation" width={36} height={36} className="object-contain" />
        </div>
        <div>
          <p className="font-bold text-[#1B4D2E] text-sm leading-none">Living in Harmony Foundation</p>
          <p className="text-gray-400 text-xs mt-0.5">Shirt Order Manager</p>
        </div>
      </div>
    </header>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1B4D2E]" />
      </div>
    )
  }

  if (loadError || !school) {
    return (
      <div className="min-h-screen bg-[#F5F4F0]">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-500">{loadError || 'This school order link could not be found.'}</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* School banner */}
        <div className="mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 text-white shadow-md" style={{ backgroundColor: '#1B4D2E' }}>
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <School className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[#8DC63F] text-xs font-semibold uppercase tracking-wide">School Order Form</p>
            <p className="font-bold text-lg leading-tight">{school.school_name}</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Place Your Order</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Fill out the form to order shirts for <strong>{school.school_name}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

          {/* School Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">School Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>School Name</Label>
                <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-[#EFF8E8] border border-[#8DC63F]/30 rounded-lg">
                  <School className="w-4 h-4 text-[#1B4D2E] flex-shrink-0" />
                  <span className="text-sm text-[#1B4D2E] font-semibold">{school.school_name}</span>
                  <span className="ml-auto text-xs text-[#1B4D2E]/50 bg-[#8DC63F]/20 px-2 py-0.5 rounded">Pre-filled</span>
                </div>
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

          {/* Shirt Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shirt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Textarea id="notes" {...register('notes')} placeholder="Any special requests..." className="mt-1" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Order Summary */}
          {watchedSize && watchedQty > 0 && (
            <Card className="border-[#8DC63F]/40 bg-[#EFF8E8]">
              <CardContent className="p-4">
                <h3 className="font-semibold text-[#1B4D2E] mb-3">Order Summary</h3>
                <div className="space-y-1 text-sm">
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
            disabled={isSubmitting}
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
