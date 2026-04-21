/**
 * @file client.ts
 * @description Browser-side Supabase client factory. Public (no auth required to import).
 * Uses the anon key — RLS policies apply to all queries made with this client.
 * Do NOT use this client for privileged writes; use `createAdminClient` from server.ts instead.
 */
import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client suitable for use in browser / client components.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from env.
 * RLS is enforced; this client has no elevated privileges.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
