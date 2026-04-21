/**
 * @file server.ts
 * @description Server-side Supabase client factories. Server-only; never import in client
 * components or browser-executed code.
 *
 * Two clients are exported:
 * - `createClient()` — session client backed by the request's cookies. RLS is enforced;
 *   use this to identify the calling user (getUser) or for user-scoped reads.
 * - `createAdminClient()` — service-role client that bypasses Supabase RLS entirely.
 *   Use only for privileged server operations (e.g. looking up team_members, writing
 *   audit_logs). Never expose data fetched via this client to unverified callers.
 */
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ─── Session Client (RLS enforced) ───────────────────────────

/**
 * Creates a server-side Supabase client scoped to the current request's cookie session.
 * RLS policies are enforced — use `getUser()` on this client to authenticate callers.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// ─── Admin Client (bypasses RLS) ─────────────────────────────

/**
 * Creates a Supabase client using the service-role key — bypasses all RLS policies.
 * IMPORTANT: Only use server-side. Never return raw rows fetched by this client to
 * unauthenticated callers; always apply your own authorization checks first.
 */
export async function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
