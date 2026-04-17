CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES shirt_catalog(id) ON DELETE SET NULL,
  catalog_item_name TEXT NOT NULL,
  shirt_size TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- Backfill existing orders into order_items
INSERT INTO order_items (order_id, catalog_item_id, catalog_item_name, shirt_size, quantity, unit_price, subtotal)
SELECT
  id,
  catalog_item_id,
  COALESCE(catalog_item_name, 'Shirt'),
  shirt_size,
  quantity,
  unit_price,
  total_amount
FROM orders
WHERE shirt_size IS NOT NULL
ON CONFLICT DO NOTHING;
