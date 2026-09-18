-- ─────────────────────────────────────────────────────────────────────────────
-- 040_order_activity_date.sql
-- "An order paid today should appear at the top of the list, dated today."
--
-- Before this, the admin list sorted by created_at, so an order placed on
-- Aug 14 and paid in September stayed buried at the bottom and the admins
-- missed the payment. `activity_at` is the date that matters operationally:
-- when it was paid, or when it was placed if it still isn't.
--
-- Generated + stored so Postgres keeps it in sync (no app code can forget it)
-- and it can be indexed for the default ordering. The original created_at /
-- date_submitted are untouched — the receipt and reports still show the real
-- date the customer placed the order.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS activity_at TIMESTAMPTZ
  GENERATED ALWAYS AS (COALESCE(date_paid, created_at)) STORED;

CREATE INDEX IF NOT EXISTS orders_activity_at_idx ON orders (activity_at DESC);
