create table if not exists discount_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  type        text not null check (type in ('percentage', 'fixed')),
  value       numeric not null check (value > 0),
  expires_at  timestamptz,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- store code always uppercase for case-insensitive matching
create unique index if not exists discount_codes_code_upper_idx on discount_codes (upper(code));

alter table orders
  add column if not exists discount_code   text,
  add column if not exists discount_amount numeric not null default 0;
