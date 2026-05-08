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
  verified_at date,
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
  is_anonymous boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.donors
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists notes text not null default '';

alter table public.payment_methods
  add column if not exists verified_at date;

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

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'admin' check (role in ('admin', 'editor')),
  is_active boolean not null default true,
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
set search_path = public, pg_temp
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

drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at
before update on public.admin_users
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

alter table public.site_settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.contacts enable row level security;
alter table public.donors enable row level security;
alter table public.building_updates enable row level security;
alter table public.gallery_items enable row level security;
alter table public.pending_confirmations enable row level security;
alter table public.fund_breakdown enable row level security;
alter table public.admin_logs enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods"
on public.payment_methods for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Public can read active contacts" on public.contacts;
create policy "Public can read active contacts"
on public.contacts for select
to anon, authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

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

drop policy if exists "Public can create pending confirmations" on public.pending_confirmations;
create policy "Public can create pending confirmations"
on public.pending_confirmations for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "Authenticated admins can manage pending confirmations" on public.pending_confirmations;
create policy "Authenticated admins can manage pending confirmations"
on public.pending_confirmations for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Public can read fund breakdown" on public.fund_breakdown;
create policy "Public can read fund breakdown"
on public.fund_breakdown for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admins can manage fund breakdown" on public.fund_breakdown;
create policy "Authenticated admins can manage fund breakdown"
on public.fund_breakdown for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can read admin logs" on public.admin_logs;
create policy "Authenticated admins can read admin logs"
on public.admin_logs for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can create admin logs" on public.admin_logs;
create policy "Authenticated admins can create admin logs"
on public.admin_logs for insert
to authenticated
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Admins can read own admin user" on public.admin_users;
create policy "Admins can read own admin user"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()) and is_active = true);

drop policy if exists "Authenticated admins can manage site settings" on public.site_settings;
create policy "Authenticated admins can manage site settings"
on public.site_settings for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage payment methods" on public.payment_methods;
create policy "Authenticated admins can manage payment methods"
on public.payment_methods for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage contacts" on public.contacts;
create policy "Authenticated admins can manage contacts"
on public.contacts for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage donors" on public.donors;
create policy "Authenticated admins can manage donors"
on public.donors for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage building updates" on public.building_updates;
create policy "Authenticated admins can manage building updates"
on public.building_updates for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can manage gallery items" on public.gallery_items;
create policy "Authenticated admins can manage gallery items"
on public.gallery_items for all
to authenticated
using (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

insert into storage.buckets (id, name, public)
values ('donasi-assets', 'donasi-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read donasi assets" on storage.objects;
create policy "Public can read donasi assets"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'donasi-assets');

drop policy if exists "Public can upload confirmation proofs" on storage.objects;
create policy "Public can upload confirmation proofs"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'donasi-assets'
  and (storage.foldername(name))[1] = 'confirmations'
);

drop policy if exists "Authenticated admins can upload donasi assets" on storage.objects;
create policy "Authenticated admins can upload donasi assets"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'donasi-assets'
  and exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can update donasi assets" on storage.objects;
create policy "Authenticated admins can update donasi assets"
on storage.objects for update
to authenticated
using (
  bucket_id = 'donasi-assets'
  and exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
)
with check (
  bucket_id = 'donasi-assets'
  and exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

drop policy if exists "Authenticated admins can delete donasi assets" on storage.objects;
create policy "Authenticated admins can delete donasi assets"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'donasi-assets'
  and exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
      and is_active = true
  )
);

-- === MIGRATION: RAB Detail (2026-05-05) ===

-- Tambah kolom realisasi per pos RAB (input manual admin)
alter table public.fund_breakdown
  add column if not exists realization_amount integer not null default 0;

-- Tabel sub-item per pos RAB
create table if not exists public.fund_breakdown_items (
  id uuid primary key default gen_random_uuid(),
  breakdown_id uuid not null references public.fund_breakdown(id) on delete cascade,
  label text not null,
  amount integer not null default 0,
  realization_amount integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.fund_breakdown_items enable row level security;

drop policy if exists "Public can read breakdown items" on public.fund_breakdown_items;
create policy "Public can read breakdown items"
  on public.fund_breakdown_items for select using (true);

drop policy if exists "Authenticated admins can manage breakdown items" on public.fund_breakdown_items;
create policy "Authenticated admins can manage breakdown items"
  on public.fund_breakdown_items for all
  using (
    exists (
      select 1 from public.admin_users
      where user_id = (select auth.uid())
        and is_active = true
    )
  );

-- === MIGRATION: Laporan Keuangan (2026-05-07) ===

create table if not exists public.expense_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  breakdown_id uuid references public.fund_breakdown(id) on delete set null,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.expense_categories(id) on delete restrict,
  description  text not null,
  amount       numeric not null check (amount > 0),
  expense_date date not null,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "Public can read active expense categories" on public.expense_categories;
create policy "Public can read active expense categories"
on public.expense_categories for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Authenticated admins can manage expense categories" on public.expense_categories;
create policy "Authenticated admins can manage expense categories"
on public.expense_categories for all
to authenticated
using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
)
with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
);

drop policy if exists "Authenticated admins can manage expenses" on public.expenses;
create policy "Authenticated admins can manage expenses"
on public.expenses for all
to authenticated
using (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
)
with check (
  exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
);

drop policy if exists "Public can select expenses" on public.expenses;
create policy "Public can select expenses"
  on public.expenses
  for select
  to anon, authenticated
  using (true);

drop trigger if exists expense_categories_updated_at on public.expense_categories;
create trigger expense_categories_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

drop trigger if exists expenses_updated_at on public.expenses;
create trigger expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- === MIGRATION: Rekening & Kas (2026-05-08) ===

create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  type           text not null check (type in ('bank', 'ewallet', 'cash')),
  account_number text not null default '',
  account_holder text not null default '',
  notes          text not null default '',
  is_active      boolean not null default true,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.account_transfers (
  id              uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id),
  to_account_id   uuid not null references public.accounts(id),
  amount          numeric not null check (amount > 0),
  transfer_date   date not null,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  check (from_account_id != to_account_id)
);

alter table public.donors
  add column if not exists account_id uuid references public.accounts(id);

alter table public.expenses
  add column if not exists account_id uuid references public.accounts(id);

alter table public.accounts enable row level security;
alter table public.account_transfers enable row level security;

drop policy if exists "Authenticated admins can manage accounts" on public.accounts;
create policy "Authenticated admins can manage accounts"
  on public.accounts for all to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
  )
  with check (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
  );

drop policy if exists "Authenticated admins can manage account_transfers" on public.account_transfers;
create policy "Authenticated admins can manage account_transfers"
  on public.account_transfers for all to authenticated
  using (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
  )
  with check (
    exists (select 1 from public.admin_users where user_id = (select auth.uid()) and is_active = true)
  );

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
