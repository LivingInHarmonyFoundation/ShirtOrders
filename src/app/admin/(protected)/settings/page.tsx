'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Save, Loader2, DollarSign, School, Building2, Tag, MessageSquare, User, Briefcase } from 'lucide-react'
import type { AppSettings, ShirtSize } from '@/types'

const ALL_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [appName, setAppName] = useState('')
  const [shirtPrice, setShirtPrice] = useState('')
  const [availableSizes, setAvailableSizes] = useState<ShirtSize[]>([])
  const [schoolEnabled, setSchoolEnabled] = useState(true)
  const [govEnabled, setGovEnabled] = useState(true)
  const [personalEnabled, setPersonalEnabled] = useState(true)
  const [privateCompanyEnabled, setPrivateCompanyEnabled] = useState(true)
  const [manualPayEnabled, setManualPayEnabled] = useState(true)
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [smsNotifications, setSmsNotifications] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(({ settings }) => {
        if (settings) {
          setSettings(settings)
          setAppName(settings.app_name || '')
          setShirtPrice(String(settings.shirt_price || '15.00'))
          setAvailableSizes(settings.available_sizes || ALL_SIZES)
          setSchoolEnabled(settings.school_orders_enabled ?? true)
          setGovEnabled(settings.government_orders_enabled ?? true)
          setPersonalEnabled(settings.personal_orders_enabled ?? true)
          setPrivateCompanyEnabled(settings.private_company_orders_enabled ?? true)
          setManualPayEnabled(settings.manual_payment_enabled ?? true)
          setConfirmationMessage(settings.confirmation_message || '')
          setAdminPhone(settings.admin_phone || '')
          setSmsNotifications(settings.sms_notifications_enabled ?? false)
        }
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const toggleSize = (size: ShirtSize) => {
    setAvailableSizes(prev =>
      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
    )
  }

  const handleSave = async () => {
    const price = parseFloat(shirtPrice)
    if (isNaN(price) || price <= 0) {
      toast.error('Shirt price must be a positive number')
      return
    }
    if (availableSizes.length === 0) {
      toast.error('At least one shirt size must be enabled')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: appName,
          shirt_price: price,
          available_sizes: availableSizes,
          school_orders_enabled: schoolEnabled,
          government_orders_enabled: govEnabled,
          personal_orders_enabled: personalEnabled,
          private_company_orders_enabled: privateCompanyEnabled,
          manual_payment_enabled: manualPayEnabled,
          confirmation_message: confirmationMessage,
          admin_phone: adminPhone || null,
          sms_notifications_enabled: smsNotifications,
        }),
      })
      if (res.ok) {
        const { settings } = await res.json()
        setSettings(settings)
        toast.success('Settings saved successfully')
      } else {
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Configure your order management system</p>
      </div>

      {/* App Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Tag className="w-4 h-4" /> Application
          </CardTitle>
          <CardDescription className="text-xs">General app settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="app_name">App Name</Label>
            <Input
              id="app_name"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="Institution Shirt Order Manager"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Pricing
          </CardTitle>
          <CardDescription className="text-xs">Set the shirt price and available sizes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="shirt_price">Price Per Shirt (USD)</Label>
            <div className="relative mt-1 max-w-[160px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <Input
                id="shirt_price"
                type="number"
                min="0.01"
                step="0.01"
                value={shirtPrice}
                onChange={e => setShirtPrice(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
          <Separator />
          <div>
            <Label>Available Shirt Sizes</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-2">Select which sizes customers can order</p>
            <div className="flex flex-wrap gap-2">
              {ALL_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    availableSizes.includes(size)
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <School className="w-4 h-4" /> Institution Types
          </CardTitle>
          <CardDescription className="text-xs">Enable or disable institution order types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <School className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">School Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow schools to place orders</p>
              </div>
            </div>
            <Switch checked={schoolEnabled} onCheckedChange={setSchoolEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Government Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow government organizations to place orders</p>
              </div>
            </div>
            <Switch checked={govEnabled} onCheckedChange={setGovEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Personal Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow individuals to place personal orders</p>
              </div>
            </div>
            <Switch checked={personalEnabled} onCheckedChange={setPersonalEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Briefcase className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Private Company Orders</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Allow private companies to place orders</p>
              </div>
            </div>
            <Switch checked={privateCompanyEnabled} onCheckedChange={setPrivateCompanyEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Manual Payment Option</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Show note for cash/check payments on checkout page</p>
            </div>
            <Switch checked={manualPayEnabled} onCheckedChange={setManualPayEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Confirmation Message
          </CardTitle>
          <CardDescription className="text-xs">Shown to customers after they complete their order</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={confirmationMessage}
            onChange={e => setConfirmationMessage(e.target.value)}
            placeholder="Thank you for your order! We will process it shortly."
            rows={3}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Phone Notifications
          </CardTitle>
          <CardDescription className="text-xs">Get a push notification on your phone when a new order comes in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Free alerts via the ntfy app — no phone number purchase needed</p>
            </div>
            <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
          </div>
          {smsNotifications && (
            <div>
              <Label htmlFor="admin_phone">ntfy Topic Name</Label>
              <Input
                id="admin_phone"
                type="text"
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="e.g. shirt-orders-lih-2026"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">
                Pick any unique private name. Install the <strong>ntfy</strong> app (iOS/Android), subscribe to this topic, and you&apos;ll receive a notification for every new order.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 pb-6">
        <Button onClick={handleSave} disabled={saving} className="text-white" style={{ backgroundColor: '#1B4D2E' }}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
        </Button>
        {settings && (
          <p className="text-xs text-gray-400">
            Last updated: {new Date(settings.updated_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}
