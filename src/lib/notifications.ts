interface OrderNotificationData {
  order_number: string
  full_name: string
  institution_type: string
  school_name?: string | null
  organization_name?: string | null
  shirt_size: string
  quantity: number
  total_amount: number
  catalog_item_name?: string | null
}

export async function sendOrderNotifications(
  order: OrderNotificationData,
  settings: {
    admin_phone?: string | null
    sms_notifications_enabled?: boolean
  }
) {
  if (!settings.sms_notifications_enabled || !settings.admin_phone) return

  const institution = order.institution_type === 'school'
    ? order.school_name || 'School'
    : order.organization_name || 'Government'

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
