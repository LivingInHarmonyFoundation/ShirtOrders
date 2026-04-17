import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ order })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = await createAdminClient()
  const body = await request.json()

  // Get current order for audit log
  const { data: currentOrder } = await adminSupabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (!currentOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const allowedFields = [
    'payment_status', 'order_status', 'delivery_status',
    'admin_notes', 'date_paid', 'date_delivered',
    'full_name', 'email', 'phone', 'shirt_size', 'quantity',
    'notes', 'school_name', 'grade', 'classroom',
    'organization_name', 'department_office',
    'payment_method',
  ]

  const updateData: Record<string, unknown> = {}
  const auditEntries: Array<{ order_id: string; field_changed: string; old_value: string | null; new_value: string | null; changed_by: string }> = []

  for (const field of allowedFields) {
    if (field in body) {
      const oldValue = currentOrder[field]
      const newValue = body[field]
      if (String(oldValue) !== String(newValue)) {
        updateData[field] = newValue
        auditEntries.push({
          order_id: id,
          field_changed: field,
          old_value: oldValue ? String(oldValue) : null,
          new_value: newValue ? String(newValue) : null,
          changed_by: user.email || user.id,
        })
      }
    }
  }

  // Auto-set date_paid when payment_status becomes paid/manual
  if (updateData.payment_status === 'paid' || updateData.payment_status === 'manual') {
    if (!currentOrder.date_paid) {
      updateData.date_paid = new Date().toISOString()
    }
  }

  // Auto-set date_delivered when delivery_status becomes delivered
  if (updateData.delivery_status === 'delivered') {
    if (!currentOrder.date_delivered) {
      updateData.date_delivered = new Date().toISOString()
    }
  }

  const { data: order, error } = await adminSupabase
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }

  // Insert audit log entries
  if (auditEntries.length > 0) {
    await adminSupabase.from('audit_logs').insert(auditEntries)
  }

  return NextResponse.json({ order })
}
