---
name: Auth and authorization model
description: How authentication and role-based access control are implemented in this app
type: project
---

Auth uses two Supabase clients:
- `createClient()` — reads the user's session cookie via `@supabase/ssr`, used only to call `supabase.auth.getUser()` to confirm a session exists.
- `createAdminClient()` — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS entirely. Used for all actual DB reads/writes in API routes.

Role model: owner > admin > staff, defined in `src/lib/permissions.ts`. Roles are stored in the `team_members` table (columns: user_id, role, is_active).

**Critical finding (April 2026):** Role enforcement is frontend-only via `useRole()` hook in `src/components/admin/role-provider.tsx`. API routes under `src/app/api/admin/` only check `user !== null`, NOT the user's role. Any authenticated user (including `staff`, who should have no access to settings, reports, or org management) can call every admin API endpoint directly.

The only API route that correctly checks role server-side is `src/app/api/admin/team/route.ts`, which uses a `getCallerRole()` helper. This pattern was NOT applied to any of the newer routes.

**Why:** No middleware.ts exists in this project. There is no route-level auth middleware that would intercept `/api/admin/*` requests.
