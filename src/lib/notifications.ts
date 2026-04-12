import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

interface OrderNotificationData {
  order_number: string
  full_name: string
  email: string
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
    admin_email?: string | null
    email_notifications_enabled?: boolean
    admin_phone?: string | null
    sms_notifications_enabled?: boolean
  }
) {
  const promises: Promise<void>[] = []

  if (settings.email_notifications_enabled && settings.admin_email) {
    promises.push(sendEmailNotification(order, settings.admin_email))
  }

  if (settings.sms_notifications_enabled && settings.admin_phone) {
    promises.push(sendPushNotification(order, settings.admin_phone))
  }

  const results = await Promise.allSettled(promises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Notification ${i} failed:`, r.reason)
    }
  })
}

async function sendEmailNotification(order: OrderNotificationData, toEmail: string) {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('Email notification skipped: GMAIL_USER or GMAIL_APP_PASSWORD not set')
    return
  }

  const fromUser = process.env.GMAIL_USER!
  const institution = order.institution_type === 'school'
    ? order.school_name || 'School'
    : order.organization_name || 'Government'

  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total_amount)

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #1B4D2E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0; font-size: 18px;">New Shirt Order</h2>
        <p style="color: #8DC63F; margin: 4px 0 0; font-size: 13px;">Order #${order.order_number}</p>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #6b7280; width: 140px;">Customer</td>
            <td style="padding: 6px 0; font-weight: 600;">${order.full_name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Email</td>
            <td style="padding: 6px 0;">${order.email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Institution</td>
            <td style="padding: 6px 0; text-transform: capitalize;">${order.institution_type} — ${institution}</td>
          </tr>
          ${order.catalog_item_name ? `
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Shirt Style</td>
            <td style="padding: 6px 0;">${order.catalog_item_name}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #6b7280;">Size × Qty</td>
            <td style="padding: 6px 0;">${order.shirt_size} × ${order.quantity}</td>
          </tr>
          <tr style="border-top: 1px solid #e5e7eb;">
            <td style="padding: 10px 0 0; color: #6b7280; font-weight: 600;">Total</td>
            <td style="padding: 10px 0 0; font-weight: 700; font-size: 16px; color: #1B4D2E;">${total}</td>
          </tr>
        </table>
      </div>
    </div>
  `

  await transporter.sendMail({
    from: `"Shirt Orders" <${fromUser}>`,
    to: toEmail,
    subject: `New Order #${order.order_number} — ${order.full_name}`,
    html,
  })
}

async function sendPushNotification(order: OrderNotificationData, ntfyTopic: string) {
  const institution = order.institution_type === 'school'
    ? order.school_name || 'School'
    : order.organization_name || 'Government'

  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total_amount)
  const style = order.catalog_item_name ? ` | ${order.catalog_item_name}` : ''

  const body = `${order.full_name} (${institution})\n${order.shirt_size} × ${order.quantity}${style} — ${total}`

  await fetch(`https://ntfy.sh/${ntfyTopic}`, {
    method: 'POST',
    headers: {
      'Title': `New Order #${order.order_number}`,
      'Priority': 'high',
      'Tags': 'shirt,shopping',
      'Content-Type': 'text/plain',
    },
    body,
  })
}
