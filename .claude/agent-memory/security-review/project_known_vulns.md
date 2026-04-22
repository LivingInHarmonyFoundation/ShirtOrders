---
name: Known security vulnerabilities (April 2026 audit)
description: Security issues identified in the April 2026 audit of admin API routes
type: project
---

Findings from first security audit (April 14, 2026):

1. **CRITICAL — No role checks on admin APIs**: All `/api/admin/` routes except `team/` only verify the user is authenticated, not their role. Staff users can call settings PATCH, export CSV, delete orgs/companies, do bulk order updates, etc.

2. **CRITICAL — Bulk PATCH on orders has no field whitelist**: `src/app/api/admin/orders/route.ts` PATCH passes `updates` object directly from `request.json()` into Supabase `.update(updates)`. Any column name accepted by the DB (e.g., `unit_price`, `total_amount`, `campaign_id`, `order_number`) can be overwritten by an authenticated user.

3. **HIGH — Settings GET is unauthenticated**: `src/app/api/admin/settings/route.ts` GET handler calls `createAdminClient()` directly with no auth check, exposing `app_settings` table contents to anyone.

4. **HIGH — File upload trusts client-supplied MIME type**: `src/app/api/admin/catalog/upload/route.ts` validates `file.type` (browser-supplied, not magic-byte verified). An attacker can spoof `Content-Type` to bypass the image allowlist.

5. **HIGH — CSV injection in export**: `src/app/api/admin/export/route.ts` and `buildOrderCsvRow()` do not sanitize formula-injection prefixes (`=`, `+`, `-`, `@`). Order fields like `full_name` or `notes` go straight to CSV cells.

6. **MEDIUM — No quantity upper bound on public order submission**: `src/app/api/orders/route.ts` Zod schema uses `z.number().int().positive()` with no max. A submitter can order arbitrarily large quantities.

7. **MEDIUM — Order number collision risk**: `generateOrderNumber()` uses 4 random digits (10,000 possibilities) with no uniqueness enforcement at the application layer.

8. **LOW — `limit` and `page` query params unclamped**: Orders GET accepts arbitrary `limit` values (e.g., `limit=999999`) which can cause large unbounded DB reads.

9. **INFO — Public endpoints use admin client**: `/api/private-companies/route.ts` and `/api/government-orgs/route.ts` use `createAdminClient()` unnecessarily for a read-only query on active records. RLS would be safer here.
