-- Patch: pindahkan akses admin dari JavaScript publik ke tabel admin_users + RLS.
-- Jalankan di Supabase SQL Editor pada project produksi.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pending_confirmations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null check (amount > 0),
  donation_date date not null,
  whatsapp text not null,
  proof_url text not null default '',
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fund_breakdown (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric not null check (amount >= 0),
  sort_order integer not null default 0
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  table_name text not null,
  record_id text,
  admin_email text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

insert into public.admin_users (user_id, email, role, is_active)
select id, email, 'admin', true
from auth.users
order by
  case when lower(email) = 'panitia@majelis.org' then 0 else 1 end,
  created_at asc
limit 1
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    is_active = true;

alter table public.admin_users enable row level security;
alter table public.pending_confirmations enable row level security;
alter table public.fund_breakdown enable row level security;
alter table public.admin_logs enable row level security;

alter table public.payment_methods
  add column if not exists verified_at date;

drop policy if exists "Admins can read own admin user" on public.admin_users;
create policy "Admins can read own admin user"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()) and is_active = true);

drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods"
on public.payment_methods for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and is_active = true
  )
);

drop policy if exists "Public can read active contacts" on public.contacts;
create policy "Public can read active contacts"
on public.contacts for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage pending confirmations" on public.pending_confirmations;
create policy "Authenticated admins can manage pending confirmations"
on public.pending_confirmations for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage fund breakdown" on public.fund_breakdown;
create policy "Authenticated admins can manage fund breakdown"
on public.fund_breakdown for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can read admin logs" on public.admin_logs;
create policy "Authenticated admins can read admin logs"
on public.admin_logs for select
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can create admin logs" on public.admin_logs;
create policy "Authenticated admins can create admin logs"
on public.admin_logs for insert
to authenticated
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage site settings" on public.site_settings;
create policy "Authenticated admins can manage site settings"
on public.site_settings for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage payment methods" on public.payment_methods;
create policy "Authenticated admins can manage payment methods"
on public.payment_methods for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage contacts" on public.contacts;
create policy "Authenticated admins can manage contacts"
on public.contacts for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage donors" on public.donors;
create policy "Authenticated admins can manage donors"
on public.donors for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage building updates" on public.building_updates;
create policy "Authenticated admins can manage building updates"
on public.building_updates for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can manage gallery items" on public.gallery_items;
create policy "Authenticated admins can manage gallery items"
on public.gallery_items for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true));

drop policy if exists "Authenticated admins can upload donasi assets" on storage.objects;
create policy "Authenticated admins can upload donasi assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'donasi-assets'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
);

drop policy if exists "Public can upload confirmation proofs" on storage.objects;
create policy "Public can upload confirmation proofs"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'donasi-assets'
  and (storage.foldername(name))[1] = 'confirmations'
);

drop policy if exists "Authenticated admins can update donasi assets" on storage.objects;
create policy "Authenticated admins can update donasi assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'donasi-assets'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
)
with check (
  bucket_id = 'donasi-assets'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
);

drop policy if exists "Authenticated admins can delete donasi assets" on storage.objects;
create policy "Authenticated admins can delete donasi assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'donasi-assets'
  and exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
);
