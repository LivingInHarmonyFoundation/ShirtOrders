-- Add delivery address for personal orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
