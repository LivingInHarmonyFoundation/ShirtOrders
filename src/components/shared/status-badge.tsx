/**
 * @file status-badge.tsx
 * @description Colored badge components for all order status dimensions. Config objects
 * for payment, order, and delivery statuses are defined in lib/utils.ts
 * (paymentStatusConfig, orderStatusConfig, deliveryStatusConfig). Institution badges
 * use a local config defined in this file.
 *
 * All four badge types are thin wrappers around the shared Badge UI component;
 * styling is driven entirely by the config objects and Tailwind class names.
 */
'use client'

import { Badge } from '@/components/ui/badge'
import { cn, paymentStatusConfig, orderStatusConfig, deliveryStatusConfig } from '@/lib/utils'
import type { PaymentStatus, OrderStatus, DeliveryStatus, InstitutionType } from '@/types'

/** PaymentStatusBadge — colored badge for pending / paid / failed / refunded / manual. */
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

/** OrderStatusBadge — colored badge for new / processing / ready / completed / cancelled. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

/** DeliveryStatusBadge — colored badge for not_delivered / partially_delivered / delivered. */
export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const config = deliveryStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

// Color config for institution type badges — defined locally (not in lib/utils)
const institutionConfig: Record<InstitutionType, { label: string; className: string }> = {
  school:          { label: 'School',          className: 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40' },
  government:      { label: 'Government',      className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400' },
  personal:        { label: 'Personal',        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  private_company: { label: 'Private Company', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  staff:           { label: 'Staff',           className: 'bg-purple-50 text-purple-700 border-purple-200' },
  municipality:    { label: 'Municipio',       className: 'bg-teal-50 text-teal-700 border-teal-200' },
}

/** InstitutionBadge — colored badge for school / government / personal / private_company. */
export function InstitutionBadge({ type }: { type: InstitutionType }) {
  const config = institutionConfig[type]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
