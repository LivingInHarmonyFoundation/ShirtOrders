-- ─────────────────────────────────────────────────────────────────────────────
-- 039_checkout_sessions.sql
-- Pay-before-order: the order row is no longer created when the customer leaves
-- the cart. Instead the fully validated + priced order is parked here as a
-- checkout session, and the real `orders` row is only inserted when payment
-- actually happens (PayPal capture, staff ATH confirmation) or when the
-- customer explicitly commits to paying cash. Abandoned sessions never become
-- orders, which removes the "pending sin pago" duplicates problem.
--
-- payload holds the exact columns for the orders insert plus its items (see
-- src/lib/checkout.ts). Service-role only: no RLS policies, so anon/session
-- clients cannot read or write it (same posture as `orders`).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  payload         JSONB NOT NULL,
  paypal_order_id TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_sessions_paypal_order_id_idx ON checkout_sessions (paypal_order_id);
CREATE INDEX IF NOT EXISTS checkout_sessions_expires_at_idx ON checkout_sessions (expires_at);

ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
