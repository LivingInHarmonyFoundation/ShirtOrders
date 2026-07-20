/**
 * @file utils.ts
 * @description Shared utility functions and config objects used across the app.
 * Exports: cn (Tailwind class merge), formatPhone, formatCurrency, formatDate,
 * formatDateTime, generateOrderNumber, paymentStatusConfig, orderStatusConfig,
 * deliveryStatusConfig, CSV_HEADERS, buildOrderCsvRow.
 *
 * Key invariants:
 * - Status config objects (paymentStatusConfig, orderStatusConfig,
 *   deliveryStatusConfig) are the single source of truth consumed by
 *   status-badge.tsx — never define badge styles elsewhere.
 * - generateOrderNumber relies on crypto.randomUUID() which is available in
 *   all server and modern browser contexts.
 */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type { PaymentStatus, OrderStatus, DeliveryStatus } from '@/types'

// ─── Tailwind Class Utility ───────────────────────────────────

/**
 * cn — merges Tailwind class names, resolving conflicts via tailwind-merge
 * and handling conditional classes via clsx.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Formatting Helpers ───────────────────────────────────────

/**
 * formatPhone — formats a raw string of digits into (XXX) XXX - XXXX.
 * Strips non-digit characters and truncates to 10 digits before formatting.
 * Returns an empty string when the input contains no digits.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`
}

/**
 * formatCurrency — formats a number as a USD currency string using the
 * browser/Node Intl API (e.g. 12.5 → "$12.50").
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * formatDate — parses an ISO date string and returns "MMM d, yyyy" (e.g.
 * "Apr 20, 2026"). Returns an em-dash for null/undefined/invalid input.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

/**
 * formatDateTime — parses an ISO date-time string and returns
 * "MMM d, yyyy h:mm a" (e.g. "Apr 20, 2026 3:45 PM"). Returns an em-dash
 * for null/undefined/invalid input.
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    return format(parseISO(dateString), 'MMM d, yyyy h:mm a')
  } catch {
    return '—'
  }
}

/**
 * generateOrderNumber — generates a unique order number of the form
 * "ORD-YYYYMMDD-XXXXXXXX" where the suffix is the first 8 hex characters of
 * a random UUID (uppercase). Called server-side when a new order is created.
 */
export function generateOrderNumber(): string {
  const date = format(new Date(), 'yyyyMMdd')
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `ORD-${date}-${random}`
}

// ─── Status Config Objects ────────────────────────────────────
// These are the single source of truth for badge labels and Tailwind classes.
// status-badge.tsx reads from these maps — do not duplicate styling elsewhere.

/**
 * paymentStatusConfig — display label and badge Tailwind classes for each
 * PaymentStatus value. Consumed by PaymentStatusBadge in status-badge.tsx.
 */
export const paymentStatusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
  refunded: { label: 'Refunded', className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400' },
  manual: { label: 'Manual', className: 'bg-[#E5F2F0] text-[#00352F] border-[#CEDC00]/40' },
}

/**
 * orderStatusConfig — display label and badge Tailwind classes for each
 * OrderStatus value. Consumed by OrderStatusBadge in status-badge.tsx.
 */
export const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
  processing: { label: 'Processing', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400' },
  ready: { label: 'Ready', className: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300' },
}

/**
 * deliveryStatusConfig — display label and badge Tailwind classes for each
 * DeliveryStatus value. Consumed by DeliveryStatusBadge in status-badge.tsx.
 */
export const deliveryStatusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  not_delivered: { label: 'Not Delivered', className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300' },
  partially_delivered: { label: 'Partial', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' },
}

// ─── CSV Export Utilities ─────────────────────────────────────

/**
 * CSV_HEADERS — ordered column headers for the orders CSV export.
 * Must stay in sync with the field order in buildOrderCsvRow.
 */
export const CSV_HEADERS = [
  'Order Number', 'Full Name', 'Email', 'Phone',
  'Institution Type', 'School Name', 'Grade', 'Classroom',
  'Organization Name', 'Department/Office', 'Region', 'Shirt Size',
  'Quantity', 'Unit Price', 'Total Amount',
  'Payment Status', 'Payment Method', 'Order Status', 'Delivery Status',
  'Date Submitted', 'Date Paid', 'Date Delivered',
  'Notes', 'Admin Notes',
]

/**
 * buildOrderCsvRow — converts a raw order record into an ordered string array
 * matching the column sequence defined in CSV_HEADERS. Null/undefined fields
 * are coerced to empty strings. Used by the admin export route.
 */
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
    String(order.region ?? ''),
    String(order.shirt_size ?? ''),
    String(order.quantity ?? ''),
    String(order.unit_price ?? ''),
    String(order.total_amount ?? ''),
    String(order.payment_status ?? ''),
    String(order.payment_method ?? ''),
    String(order.order_status ?? ''),
    String(order.delivery_status ?? ''),
    String(order.date_submitted ?? ''),
    String(order.date_paid ?? ''),
    String(order.date_delivered ?? ''),
    String(order.notes ?? ''),
    String(order.admin_notes ?? ''),
  ]
}
