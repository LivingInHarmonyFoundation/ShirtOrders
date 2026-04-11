import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, or GIF allowed' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const filename = `${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = await createAdminClient()
  const { error } = await admin.storage
    .from('shirt-images')
    .upload(filename, bytes, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('shirt-images').getPublicUrl(filename)
  return NextResponse.json({ url: publicUrl })
}
