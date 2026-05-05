alter table campaigns
  add column if not exists slug text,
  add column if not exists banner_url text,
  add column if not exists badge_url text;

create unique index if not exists campaigns_slug_idx on campaigns (slug) where slug is not null;
