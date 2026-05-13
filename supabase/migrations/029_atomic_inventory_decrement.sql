-- Atomically decrement shirt inventory by the requested quantity.
-- Returns the new quantity on success, or -1 if there is insufficient stock.
-- Uses a CTE so the UPDATE and the result come from a single round-trip.
create or replace function decrement_shirt_inventory(
  p_inventory_id uuid,
  p_quantity     integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_qty integer;
begin
  update shirt_inventory
     set quantity   = quantity - p_quantity,
         updated_at = now()
   where id       = p_inventory_id
     and quantity >= p_quantity
  returning quantity into v_new_qty;

  -- If no row was updated, stock was insufficient (or id not found)
  return coalesce(v_new_qty, -1);
end;
$$;
