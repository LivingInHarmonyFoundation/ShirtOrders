-- 015_manual_payments.sql
-- Replace Stripe with PayPal. Records which payment method the customer chose.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('paypal', 'venmo', 'card', 'cash'))
    DEFAULT NULL;

CREATE INDEX IF NOT EXISTS orders_payment_method_idx ON orders(payment_method);

-- Cash toggle in app_settings (PayPal/Venmo/Card controlled by PayPal SDK config)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS cash_enabled BOOLEAN NOT NULL DEFAULT false;
