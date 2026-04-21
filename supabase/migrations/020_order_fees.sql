alter table app_settings
  add column if not exists order_fees jsonb not null default '[]';

alter table orders
  add column if not exists applied_fees jsonb;
