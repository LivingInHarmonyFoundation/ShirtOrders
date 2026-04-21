/**
 * @file route.ts
 * @description Catalog image upload endpoint. POST accepts a multipart form-data file,
 * validates it by magic bytes (not the client-supplied MIME header), enforces a 5MB size
 * limit, generates a UUID-based filename to prevent path traversal, and stores the result
 * in the `shirt-images` Supabase Storage bucket. Returns the public URL on success.
 * Requires authentication and the `canManageSettings` permission.
 * Uses `createAdminClient()` (bypasses RLS) for Storage operations.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/supabase/require-role'

// ─── Magic-Byte Detection ─────────────────────────────────────

/**
 * Detect the MIME type of an image by inspecting its leading magic bytes.
 * This deliberately ignores the client-supplied Content-Type header, which can be
 * spoofed. Supports PNG, JPEG, GIF, and WebP.
 * Returns null if the byte sequence does not match any supported format.
 */
function detectMime(bytes: Uint8Array): string | null {
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png'
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg'
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  return null
}

// ─── MIME → Extension Map ─────────────────────────────────────

/** Maps detected MIME types to their canonical file extensions for storage filenames. */
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

// ─── POST /api/admin/catalog/upload ──────────────────────────

/**
 * POST /api/admin/catalog/upload — upload a shirt image to Supabase Storage.
 * Requires authentication and the `canManageSettings` permission.
 * Accepts multipart/form-data with a single `file` field.
 * Validation rules:
 *   - File must be present
 *   - File size must be ≤ 5MB
 *   - File content must match PNG, JPEG, GIF, or WebP magic bytes (MIME header is ignored)
 * The filename is a random UUID + detected extension, preventing path traversal attacks.
 * Uses `createAdminClient()` (bypasses RLS) for the Storage upload.
 * Response: { url: string } — the public URL of the uploaded file.
 */
export async function POST(request: NextRequest) {
  // ─── Auth & Permission Checks ────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await requirePermission(user.id, 'canManageSettings')
  if (auth instanceof NextResponse) return auth

  // ─── File Validation ──────────────────────────────────────────
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Enforce 5MB size limit before reading the full buffer
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  // Validate by magic bytes — never trust client-supplied MIME type
  const detectedMime = detectMime(bytes)
  if (!detectedMime) {
    return NextResponse.json({ error: 'Only JPG, PNG, WebP, or GIF allowed' }, { status: 400 })
  }

  // ─── Storage Upload ───────────────────────────────────────────
  // UUID-based filename prevents path traversal and collisions
  const ext = MIME_TO_EXT[detectedMime]
  const filename = `${crypto.randomUUID()}.${ext}`

  // createAdminClient() bypasses RLS — required for Storage bucket writes
  const admin = await createAdminClient()
  const { error } = await admin.storage
    .from('shirt-images')
    .upload(filename, bytes, { contentType: detectedMime, upsert: false })

  if (error) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('shirt-images').getPublicUrl(filename)
  return NextResponse.json({ url: publicUrl })
}
