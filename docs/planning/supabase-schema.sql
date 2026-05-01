-- Supabase setup untuk Website Donasi Majelis Nuruzh Zholam
-- Jalankan di Supabase SQL Editor.

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  majelis_name text not null default 'Majelis Nuruzh Zholam',
  majelis_address text not null default '',
  majelis_program text not null default '',
  majelis_photo_url text not null default '',
  donation_target numeric not null default 0 check (donation_target >= 0),
  funds_used numeric not null default 0 check (funds_used >= 0),
  report_date date not null default current_date,
  report_note text not null default '',
  qris_url text not null default '',
  whatsapp_message text not null default 'Assalamualaikum, saya ingin berdonasi untuk pembangunan Majelis Nuruzh Zholam',
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  method_type text not null check (method_type in ('bank', 'ewallet')),
  code text not null,
  label text not null,
  name text not null,
  account_number text not null default '',
  account_name text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_methods_type_code_idx
on public.payment_methods (method_type, code);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  person_name text not null,
  whatsapp text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_whatsapp_format check (whatsapp ~ '^628[0-9]{8,15}$')
);

create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null check (amount > 0),
  donation_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.building_updates (
  id uuid primary key default gen_random_uuid(),
  update_date date not null,
  title text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists payment_methods_updated_at on public.payment_methods;
create trigger payment_methods_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists contacts_updated_at on public.contacts;
create trigger contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

drop trigger if exists donors_updated_at on public.donors;
create trigger donors_updated_at
before update on public.donors
for each row execute function public.set_updated_at();

drop trigger if exists building_updates_updated_at on public.building_updates;
create trigger building_updates_updated_at
before update on public.building_updates
for each row execute function public.set_updated_at();

drop trigger if exists gallery_items_updated_at on public.gallery_items;
create trigger gallery_items_updated_at
before update on public.gallery_items
for each row execute function public.set_updated_at();

insert into public.site_settings (id, majelis_name, majelis_program, report_note)
values (
  1,
  'Majelis Nuruzh Zholam',
  'Pengajian rutin setiap Minggu & Kamis malam',
  'Laporan dana akan diperbarui oleh panitia.'
)
on conflict (id) do nothing;

insert into public.payment_methods (method_type, code, label, name, sort_order)
values
  ('bank', 'bca', 'BCA', 'Bank BCA', 10),
  ('bank', 'mandiri', 'MDR', 'Bank Mandiri', 20),
  ('bank', 'bri', 'BRI', 'Bank BRI', 30),
  ('bank', 'bni', 'BNI', 'Bank BNI', 40),
  ('ewallet', 'gopay', 'G', 'GoPay', 50),
  ('ewallet', 'ovo', 'O', 'OVO', 60),
  ('ewallet', 'dana', 'D', 'DANA', 70)
on conflict (method_type, code) do nothing;

alter table public.site_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.contacts enable row level security;
alter table public.donors enable row level security;
alter table public.building_updates enable row level security;
alter table public.gallery_items enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods"
on public.payment_methods for select
to anon, authenticated
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read active contacts" on public.contacts;
create policy "Public can read active contacts"
on public.contacts for select
to anon, authenticated
using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Public can read donors" on public.donors;
create policy "Public can read donors"
on public.donors for select
to anon, authenticated
using (true);

drop policy if exists "Public can read building updates" on public.building_updates;
create policy "Public can read building updates"
on public.building_updates for select
to anon, authenticated
using (true);

drop policy if exists "Public can read gallery items" on public.gallery_items;
create policy "Public can read gallery items"
on public.gallery_items for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admins can manage site settings" on public.site_settings;
create policy "Authenticated admins can manage site settings"
on public.site_settings for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage payment methods" on public.payment_methods;
create policy "Authenticated admins can manage payment methods"
on public.payment_methods for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage contacts" on public.contacts;
create policy "Authenticated admins can manage contacts"
on public.contacts for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage donors" on public.donors;
create policy "Authenticated admins can manage donors"
on public.donors for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage building updates" on public.building_updates;
create policy "Authenticated admins can manage building updates"
on public.building_updates for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated admins can manage gallery items" on public.gallery_items;
create policy "Authenticated admins can manage gallery items"
on public.gallery_items for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('donasi-assets', 'donasi-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read donasi assets" on storage.objects;
create policy "Public can read donasi assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'donasi-assets');

drop policy if exists "Authenticated admins can upload donasi assets" on storage.objects;
create policy "Authenticated admins can upload donasi assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'donasi-assets');

drop policy if exists "Authenticated admins can update donasi assets" on storage.objects;
create policy "Authenticated admins can update donasi assets"
on storage.objects for update
to authenticated
using (bucket_id = 'donasi-assets')
with check (bucket_id = 'donasi-assets');

drop policy if exists "Authenticated admins can delete donasi assets" on storage.objects;
create policy "Authenticated admins can delete donasi assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'donasi-assets');
