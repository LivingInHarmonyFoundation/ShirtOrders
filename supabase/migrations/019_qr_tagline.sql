alter table app_settings
  add column if not exists qr_tagline text not null default 'Únete a la lucha contra la soledad';
