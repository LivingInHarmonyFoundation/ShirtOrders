create table if not exists shirt_inventory (
  id              uuid primary key default gen_random_uuid(),
  catalog_item_id uuid references shirt_catalog(id) on delete cascade,
  shirt_size      text not null,
  quantity        integer not null default 0,
  low_stock_threshold integer not null default 10,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Unique per (catalog_item_id, size): one row per design+size combo
create unique index if not exists shirt_inventory_item_size_idx
  on shirt_inventory (catalog_item_id, shirt_size)
  where catalog_item_id is not null;

-- Unique per size for "general" inventory (no specific catalog item)
create unique index if not exists shirt_inventory_general_size_idx
  on shirt_inventory (shirt_size)
  where catalog_item_id is null;

-- Enable RLS; app uses service_role key so no additional policies needed
alter table shirt_inventory enable row level security;
