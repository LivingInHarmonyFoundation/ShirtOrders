/**
 * @file notifications.ts
 * @description Sends push notifications for new orders via ntfy.sh.
 *
 * Key invariant: The `admin_phone` field in AppSettings is NOT a phone number
 * — it is the ntfy.sh topic name. The notification is delivered to whoever
 * subscribes to https://ntfy.sh/<admin_phone>.
 *
 * Notification delivery failures are logged but never propagate as errors, so
 * they never block order processing.
 */

// ─── Types ────────────────────────────────────────────────────

/**
 * OrderNotificationData — the subset of order fields needed to compose the
 * push notification message body.
 */
interface OrderNotificationData {
  order_number: string
  full_name: string
  institution_type: string
  school_name?: string | null
  organization_name?: string | null
  company_name?: string | null
  shirt_size: string
  quantity: number
  total_amount: number
  catalog_item_name?: string | null
}

// ─── Notification Sender ──────────────────────────────────────

/**
 * sendOrderNotifications — fires a high-priority ntfy.sh push notification
 * summarising a new order. Silently no-ops when notifications are disabled
 * or `admin_phone` (the ntfy topic) is not configured.
 *
 * Message format:
 *   "<full_name> (<institution>)\n<size> × <qty>[| <catalog item>] — <total>"
 *
 * Errors during the fetch are caught and logged, never re-thrown.
 */
export async function sendOrderNotifications(
  order: OrderNotificationData,
  settings: {
    admin_phone?: string | null
    sms_notifications_enabled?: boolean
  }
) {
  if (!settings.sms_notifications_enabled || !settings.admin_phone) return

  // Label the order by its actual institution type — falling back to a readable
  // category name when the entity-specific field isn't set.
  const institution =
    order.institution_type === 'school'          ? (order.school_name || 'School') :
    order.institution_type === 'government'       ? (order.organization_name || 'Government') :
    order.institution_type === 'private_company'  ? (order.company_name || 'Private Company') :
    order.institution_type === 'personal'         ? 'Personal' :
    order.institution_type === 'staff'            ? 'Staff' :
    order.institution_type

  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total_amount)
  const style = order.catalog_item_name ? ` | ${order.catalog_item_name}` : ''
  const body = `${order.full_name} (${institution})\n${order.shirt_size} × ${order.quantity}${style} — ${total}`

  try {
    await fetch(`https://ntfy.sh/${settings.admin_phone}`, {
      method: 'POST',
      headers: {
        'Title': `New Order #${order.order_number}`,
        'Priority': 'high',
        'Tags': 'shirt,shopping',
        'Content-Type': 'text/plain',
      },
      body,
    })
  } catch (e) {
    console.error('Push notification failed:', e)
  }
}

/**
 * sendLowInventoryNotification — fires a high-priority ntfy.sh push notification
 * when one or more inventory items have crossed below their low-stock threshold.
 * Silently no-ops when notifications are disabled, the topic is not configured,
 * or the items list is empty.
 *
 * Errors during the fetch are caught and logged, never re-thrown.
 */
export async function sendLowInventoryNotification(
  items: { size: string; catalogItemName: string | null; quantity: number; threshold: number }[],
  settings: { admin_phone?: string | null; sms_notifications_enabled?: boolean }
) {
  if (!settings.sms_notifications_enabled || !settings.admin_phone || items.length === 0) return

  const lines = items.map(i => {
    const name = i.catalogItemName ? `${i.catalogItemName} — ` : ''
    return `${name}${i.size}: ${i.quantity} left (threshold: ${i.threshold})`
  }).join('\n')

  try {
    await fetch(`https://ntfy.sh/${settings.admin_phone}`, {
      method: 'POST',
      headers: {
        'Title': `⚠️ Low Inventory Alert`,
        'Priority': 'high',
        'Tags': 'warning,shirt',
        'Content-Type': 'text/plain',
      },
      body: `Low stock detected:\n${lines}`,
    })
  } catch (e) {
    console.error('Low inventory notification failed:', e)
  }
}
