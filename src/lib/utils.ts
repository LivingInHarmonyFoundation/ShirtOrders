import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { PaymentStatus, OrderStatus, DeliveryStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a')
  } catch {
    return '—'
  }
}

export function generateOrderNumber(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD-${date}-${random}`
}

export const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400' },
  manual: { label: 'Manual', className: 'bg-[#EFF8E8] text-[#1B4D2E] border-[#8DC63F]/40' },
}

export const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
  processing: { label: 'Processing', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400' },
  ready: { label: 'Ready', className: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300' },
}

export const deliveryStatusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  not_delivered: { label: 'Not Delivered', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300' },
  partially_delivered: { label: 'Partial', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
}

export const CSV_HEADERS = [
  'Order Number', 'Full Name', 'Email', 'Phone',
  'Institution Type', 'School Name', 'Grade', 'Classroom',
  'Organization Name', 'Department/Office', 'Shirt Size',
  'Quantity', 'Unit Price', 'Total Amount',
  'Payment Status', 'Order Status', 'Delivery Status',
  'Date Submitted', 'Date Paid', 'Date Delivered',
  'Notes', 'Admin Notes',
]

export function buildOrderCsvRow(order: Record<string, unknown>): string[] {
  return [
    String(order.order_number ?? ''),
    String(order.full_name ?? ''),
    String(order.email ?? ''),
    String(order.phone ?? ''),
    String(order.institution_type ?? ''),
    String(order.school_name ?? ''),
    String(order.grade ?? ''),
    String(order.classroom ?? ''),
    String(order.organization_name ?? ''),
    String(order.department_office ?? ''),
    String(order.shirt_size ?? ''),
    String(order.quantity ?? ''),
    String(order.unit_price ?? ''),
    String(order.total_amount ?? ''),
    String(order.payment_status ?? ''),
    String(order.order_status ?? ''),
    String(order.delivery_status ?? ''),
    String(order.date_submitted ?? ''),
    String(order.date_paid ?? ''),
    String(order.date_delivered ?? ''),
    String(order.notes ?? ''),
    String(order.admin_notes ?? ''),
  ]
}
