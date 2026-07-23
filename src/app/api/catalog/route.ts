import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const admin = await createAdminClient()
  const { data, error } = await admin
    .from('shirt_catalog')
    .select('id, name, description, image_url, back_image_url, display_order, price, available_sizes, size_prices')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ items: [] })
  return NextResponse.json({ items: data || [] })
}
