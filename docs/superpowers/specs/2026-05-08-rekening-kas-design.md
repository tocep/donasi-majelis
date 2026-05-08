# Desain: Fitur Rekening & Kas (Dimana Uang Disimpan)

**Tanggal:** 2026-05-08  
**Status:** Disetujui

---

## Ringkasan

Tambah fitur untuk melacak **dimana uang majelis tersimpan** — di rekening bank mana, e-wallet mana, atau kas tunai. Setiap donasi dan pengeluaran dicatat keluar/masuk dari rekening tertentu, sehingga saldo per rekening dihitung otomatis. Admin juga bisa mencatat transfer antar rekening.

Fitur ini hanya tampil di panel admin — tidak ada perubahan di halaman publik.

---

## 1. Model Data

### Tabel Baru: `accounts`

```sql
create table public.accounts (
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
```

Contoh data:
- "BCA Majelis" (bank), "Kas Tunai" (cash), "GoPay Bendahara" (ewallet)

Admin bisa tambah rekening sendiri — tidak terikat daftar bank bawaan.

### Tabel Baru: `account_transfers`

```sql
create table public.account_transfers (
  id              uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id),
  to_account_id   uuid not null references public.accounts(id),
  amount          numeric not null check (amount > 0),
  transfer_date   date not null,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  check (from_account_id != to_account_id)
);
```

### Modifikasi Tabel Existing

```sql
-- donors: rekening tujuan donasi masuk (nullable untuk data lama)
alter table public.donors
  add column if not exists account_id uuid references public.accounts(id);

-- expenses: rekening sumber pengeluaran (nullable untuk data lama)
alter table public.expenses
  add column if not exists account_id uuid references public.accounts(id);
```

Kolom `account_id = null` berarti "Belum Ditentukan" — data lama sebelum fitur ini aktif.

### Kalkulasi Saldo Per Rekening

Dihitung client-side dari data yang sudah di-load:

```
Saldo(X) = SUM(donors.amount WHERE account_id = X)
          - SUM(expenses.amount WHERE account_id = X)
          + SUM(account_transfers.amount WHERE to_account_id = X)
          - SUM(account_transfers.amount WHERE from_account_id = X)
```

---

## 2. RLS Policies

```sql
alter table public.accounts enable row level security;
alter table public.account_transfers enable row level security;

-- accounts: admin bisa baca semua, termasuk yang nonaktif
create policy "Authenticated admins can manage accounts"
  on public.accounts for all to authenticated
  using (
    exists (select 1 from public.admin_users
            where user_id = (select auth.uid()) and is_active = true)
  )
  with check (
    exists (select 1 from public.admin_users
            where user_id = (select auth.uid()) and is_active = true)
  );

-- account_transfers: hanya admin
create policy "Authenticated admins can manage account_transfers"
  on public.account_transfers for all to authenticated
  using (
    exists (select 1 from public.admin_users
            where user_id = (select auth.uid()) and is_active = true)
  )
  with check (
    exists (select 1 from public.admin_users
            where user_id = (select auth.uid()) and is_active = true)
  );
```

---

## 3. UI Admin

### Seksi Baru: "Rekening" di `admin.html`

**Kartu Ringkasan Saldo**
- Satu kartu per rekening aktif, menampilkan: nama, tipe (ikon), saldo terkini
- Tombol "Transfer" dan "Edit" di tiap kartu
- Satu kartu "Belum Ditentukan" — menampilkan dua angka terpisah: total pemasukan belum diassign dan total pengeluaran belum diassign (bukan saldo net), dengan tombol "Lengkapi Data"

**Tabel Riwayat Transfer**
Kolom: Tanggal | Dari | Ke | Nominal | Catatan | Hapus

**Tombol Aksi**
- "Tambah Rekening" — buka modal form: Nama, Tipe (bank/ewallet/cash), Nomor Rekening, Nama Pemilik, Catatan
- "Catat Transfer" — buka modal form: Dari Rekening, Ke Rekening, Nominal, Tanggal, Catatan

---

### Perubahan Modal Donor (Tambah & Edit)

Tambah dropdown **"Masuk ke Rekening"**:
- Pilihan: semua `accounts` aktif (diurutkan `sort_order`)
- Opsi kosong: "— Belum Ditentukan —" (nilai null)
- Untuk data baru: wajib dipilih (validasi form)
- Untuk edit data lama: opsional

---

### Perubahan Modal Pengeluaran (Tambah & Edit)

Tambah dropdown **"Keluar dari Rekening"**:
- Pilihan: semua `accounts` aktif
- Opsi kosong: "— Belum Ditentukan —" (nilai null)
- Untuk data baru: wajib dipilih (validasi form)

---

### Modal "Lengkapi Data" (Migrasi Data Lama)

Daftar donasi dan pengeluaran yang `account_id = null`:
- Tab "Pemasukan" dan tab "Pengeluaran"
- Setiap baris: tanggal, nama/keterangan, nominal, dropdown pilih rekening
- Tombol "Simpan Semua" — update semua baris sekaligus
- Bulk assign: centang beberapa baris → pilih rekening → apply ke semua yang dicentang

---

## 4. Logika JS (`admin.js`)

### Fungsi Utama

```js
// Load semua data sekaligus (paralel)
async function loadAccountsSection() {
  const [accounts, transfers, donors, expenses] = await Promise.all([
    supabase.from('accounts').select('*').order('sort_order'),
    supabase.from('account_transfers').select('*').order('transfer_date', { ascending: false }),
    supabase.from('donors').select('id, amount, account_id'),
    supabase.from('expenses').select('id, amount, account_id'),
  ]);
  renderAccountCards(accounts, donors, expenses, transfers);
  renderTransferTable(transfers, accounts);
}

// Kalkulasi saldo client-side
function calcBalance(accountId, donors, expenses, transfers) {
  const income = donors.filter(d => d.account_id === accountId)
                       .reduce((s, d) => s + d.amount, 0);
  const outcome = expenses.filter(e => e.account_id === accountId)
                          .reduce((s, e) => s + e.amount, 0);
  const transferIn = transfers.filter(t => t.to_account_id === accountId)
                              .reduce((s, t) => s + t.amount, 0);
  const transferOut = transfers.filter(t => t.from_account_id === accountId)
                               .reduce((s, t) => s + t.amount, 0);
  return income - outcome + transferIn - transferOut;
}
```

### CRUD Rekening
- Tambah, edit (nama/tipe/nomor/pemilik/catatan/sort_order), nonaktifkan (soft delete via `is_active = false`)
- Rekening tidak bisa dihapus permanen jika masih ada transaksi terkait — hanya bisa dinonaktifkan

### Catat Transfer
- Validasi: from ≠ to, amount > 0, tanggal tidak kosong
- Insert ke `account_transfers`, reload section

### Migrasi Data Lama
- Query donors + expenses dengan `account_id IS NULL`
- Update per-baris atau bulk: `update donors set account_id = X where id in (...)`

---

## 5. File yang Diubah

| File | Perubahan |
|---|---|
| `docs/planning/supabase-schema.sql` | Tambah tabel `accounts`, `account_transfers`, kolom `account_id` di `donors` & `expenses`, RLS policies |
| `admin.html` | Tambah seksi Rekening, modal tambah rekening, modal catat transfer, modal lengkapi data; perbarui modal donor & expense |
| `admin.js` | Tambah modul accounts — CRUD, transfer, kalkulasi saldo, migrasi data lama |

Tidak ada perubahan di `laporan.html`, `laporan.js`, `index.html`, `script.js`.

---

## 6. Urutan Implementasi

1. Jalankan migrasi SQL di Supabase SQL Editor
2. Perbarui `admin.js` — modul accounts (CRUD + transfer + saldo + migrasi)
3. Perbarui `admin.html` — seksi Rekening + modal + perbaruan modal donor/expense
4. Uji: tambah rekening, assign ke donasi baru, assign ke pengeluaran baru, catat transfer, cek saldo
5. Migrasi data lama via modal "Lengkapi Data"

---

## 7. Batasan Desain (Out of Scope)

- Tidak ada tampilan saldo di halaman publik
- Tidak ada notifikasi saldo minimum
- Tidak ada rekonsiliasi otomatis dengan data bank
- Rekening tidak bisa dihapus permanen jika ada transaksi terkait
