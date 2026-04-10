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
  school:     { label: 'School',     className: 'bg-[#EFF8E8] text-[#1B4D2E] border-[#8DC63F]/40' },
  government: { label: 'Government', className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400' },
}

export function InstitutionBadge({ type }: { type: InstitutionType }) {
  const config = institutionConfig[type]
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', config.className)}>
      {config.label}
    </Badge>
  )
}
