'use client'

import { Badge } from '@/components/ui/badge'
import { cn, paymentStatusConfig, orderStatusConfig, deliveryStatusConfig } from '@/lib/utils'
import type { PaymentStatus, OrderStatus, DeliveryStatus, InstitutionType } from '@/types'

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = paymentStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const config = deliveryStatusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}

const institutionConfig: Record<InstitutionType, { label: string; className: string }> = {
  school:          { label: 'School',          className: 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40' },
  government:      { label: 'Government',      className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400' },
  personal:        { label: 'Personal',        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  private_company: { label: 'Private Company', className: 'bg-orange-50 text-orange-700 border-orange-200' },
}

export function InstitutionBadge({ type }: { type: InstitutionType }) {
  const config = institutionConfig[type]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
