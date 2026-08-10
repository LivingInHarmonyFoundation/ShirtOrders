-- ─────────────────────────────────────────────────────────────────────────────
-- 038_ath_movil_payment.sql
-- Allow 'ath_movil' as a payment method. Staff members sell shirts in person
-- and buyers pay the foundation directly via ATH Móvil; the admin records the
-- payment on the order (payment_status paid + payment_method ath_movil).
-- Additive and non-destructive: every existing value remains valid.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('paypal', 'venmo', 'card', 'cash', 'ath_movil'));
