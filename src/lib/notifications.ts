import { Resend } from 'resend'
import twilio from 'twilio'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
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
    promises.push(sendSmsNotification(order, settings.admin_phone))
  }

  // Fire both in parallel, don't let failures block the order response
  const results = await Promise.allSettled(promises)
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Notification ${i} failed:`, r.reason)
    }
  })
}

async function sendEmailNotification(order: OrderNotificationData, toEmail: string) {
  if (!resend) {
    console.warn('Email notification skipped: RESEND_API_KEY not set')
    return
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@resend.dev'
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

  await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject: `New Order #${order.order_number} — ${order.full_name}`,
    html,
  })
}

async function sendSmsNotification(order: OrderNotificationData, toPhone: string) {
  const client = getTwilioClient()
  if (!client) {
    console.warn('SMS notification skipped: Twilio credentials not set')
    return
  }

  const fromPhone = process.env.TWILIO_PHONE_NUMBER
  if (!fromPhone) {
    console.warn('SMS notification skipped: TWILIO_PHONE_NUMBER not set')
    return
  }

  const institution = order.institution_type === 'school'
    ? order.school_name || 'School'
    : order.organization_name || 'Government'

  const total = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total_amount)

  const style = order.catalog_item_name ? ` | ${order.catalog_item_name}` : ''

  const body = `New Order #${order.order_number}\n${order.full_name} (${institution})\n${order.shirt_size} x${order.quantity}${style}\nTotal: ${total}`

  await client.messages.create({
    to: toPhone,
    from: fromPhone,
    body,
  })
}
