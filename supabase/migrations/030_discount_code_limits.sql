-- Add optional usage limit and entity restriction to discount codes.
-- max_uses = NULL means unlimited; max_uses = 1 means one-time use.
-- restricted_to_type/name are checked at apply time against the order's institution.
ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS max_uses           integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS restricted_to_type text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS restricted_to_name text    DEFAULT NULL;
