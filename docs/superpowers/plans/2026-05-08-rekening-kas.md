# Rekening & Kas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah fitur pelacakan rekening (bank/ewallet/kas tunai) di admin panel — setiap donasi dan pengeluaran terhubung ke rekening, saldo dihitung otomatis, admin bisa kelola rekening dan catat transfer antar rekening.

**Architecture:** Tabel baru `accounts` dan `account_transfers` di Supabase; kolom `account_id` ditambahkan ke `donors` dan `expenses`; semua logika baru masuk ke `admin.js` dan `admin.html` mengikuti pola lazy-load yang sudah ada. `state.accounts.list` di-load eagerly karena dibutuhkan di dropdown modal donor & expense. Transfer dan saldo dihitung lazily saat tab Rekening diklik pertama kali.

**Tech Stack:** Vanilla JS, Supabase JS v2, HTML/CSS (style.css existing)

---

## File Map

| File | Perubahan |
|---|---|
| `docs/planning/supabase-schema.sql` | Tambah migration block: tabel `accounts`, `account_transfers`, kolom `account_id` di `donors` & `expenses`, RLS, trigger |
| `admin.html` | Tambah tab "Rekening" + `panel-accounts` section |
| `admin.js` | Tambah state, load functions, render functions, extend modal system |

---

## Task 1: SQL Migration

**Files:**
- Modify: `docs/planning/supabase-schema.sql` (append di bagian bawah)

- [ ] **Step 1: Tambah blok migrasi ke supabase-schema.sql**

Append ke bawah file:

```sql
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
```

- [ ] **Step 2: Jalankan di Supabase SQL Editor**

Buka Supabase project → SQL Editor → paste seluruh blok di atas → Run.

Verifikasi: tabel `accounts` dan `account_transfers` muncul di Table Editor. Tabel `donors` dan `expenses` punya kolom `account_id` (nullable uuid).

- [ ] **Step 3: Commit**

```
git add docs/planning/supabase-schema.sql
git commit -m "feat: migrasi SQL tabel accounts dan account_transfers"
```

---

## Task 2: State + Data Layer (`admin.js`)

**Files:**
- Modify: `admin.js` — state object, `loadAdminData`, tambah `loadAccountsData`, `loadAccountsSection`, `retryAccountsLoad`

- [ ] **Step 1: Tambah `accounts` ke state object**

Di dalam objek `state` (setelah `galleryLoaded: false,`), tambah:

```js
accounts: {
  list: [],       // dimuat eagerly di loadAdminData
  transfers: [],
  allDonors: [],  // id, amount, account_id — dimuat lazily
  allExpenses: [],
  loaded: false,
  error: '',
},
```

- [ ] **Step 2: Load accounts list di `loadAdminData()`**

Di dalam `loadAdminData()`, setelah `contactsRes` query, tambah:

```js
const accountsRes = await runAdminQuery(
  'accounts',
  adminDb.from('accounts').select('*').order('sort_order', { ascending: true })
);
```

Setelah `state.contacts = contactsRes.data || [];`, tambah:

```js
state.accounts.list = accountsRes.data || [];
state.accounts.loaded = false;
```

- [ ] **Step 3: Tambah tiga fungsi load baru**

Tambah setelah fungsi `loadUpdatesData()`:

```js
async function loadAccountsData() {
  const [transfersRes, donorsRes, expensesRes] = await Promise.all([
    adminDb.from('account_transfers').select('*').order('transfer_date', { ascending: false }),
    adminDb.from('donors').select('id, amount, account_id'),
    adminDb.from('expenses').select('id, amount, account_id'),
  ]);
  if (transfersRes.error) throw transfersRes.error;
  if (donorsRes.error) throw donorsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  state.accounts.transfers = transfersRes.data || [];
  state.accounts.allDonors = donorsRes.data || [];
  state.accounts.allExpenses = expensesRes.data || [];
  state.accounts.error = '';
  state.accounts.loaded = true;
}

async function loadAccountsSection() {
  try {
    await loadAccountsData();
    renderAccounts();
  } catch (error) {
    state.accounts.error = error.message || 'Data rekening belum dapat dimuat.';
    renderAccounts();
  }
}

async function retryAccountsLoad() {
  state.accounts.error = '';
  renderAccounts();
  try {
    await loadAccountsData();
    renderAccounts();
    showToast('Data rekening berhasil dimuat.');
  } catch (error) {
    state.accounts.error = error.message || 'Data rekening belum dapat dimuat.';
    renderAccounts();
    showToast(state.accounts.error, true);
  }
}
```

- [ ] **Step 4: Tambah lazy-load trigger di `bindAdminEvents()`**

Di dalam blok `querySelectorAll('.admin-tab').forEach`, setelah blok `if (btn.dataset.adminTab === 'finance' ...)`:

```js
if (btn.dataset.adminTab === 'accounts' && !state.accounts.loaded && !state.accounts.error) {
  loadAccountsSection();
}
```

- [ ] **Step 5: Tambah event listeners untuk tombol panel accounts**

Di dalam `bindAdminEvents()`, setelah baris `document.getElementById('finance-manage-cat-btn')...`:

```js
document.getElementById('accounts-migrate-btn').addEventListener('click', openMigrateModal);
document.getElementById('accounts-transfer-btn').addEventListener('click', () => openModal('transfer'));
```

- [ ] **Step 6: Extend lookup maps**

Di fungsi `collection()`, tambah:

```js
account: state.accounts.list,
transfer: state.accounts.transfers,
```

Di fungsi `tableName()`, tambah:

```js
account: 'accounts',
transfer: 'account_transfers',
```

Di fungsi `modalLabel()`, tambah:

```js
account: 'Rekening',
transfer: 'Transfer',
```

- [ ] **Step 7: Update `handleModalSave` — tambah migrate handler**

Di dalam `handleModalSave`, setelah blok `if (type === 'expense-category') { ... }`:

```js
if (type === 'migrate-accounts') {
  await saveMigrateData();
  return;
}
```

- [ ] **Step 8: Update `handleModalSave` — reload setelah save**

Ganti blok `closeModal(); if (type === 'expense') { ... } else { ... }` menjadi:

```js
closeModal();
if (type === 'account' || type === 'transfer') {
  const accRes = await adminDb.from('accounts').select('*').order('sort_order', { ascending: true });
  if (!accRes.error) state.accounts.list = accRes.data || [];
  state.accounts.loaded = false;
  await loadAccountsData();
  renderAccounts();
} else if (type === 'expense') {
  state.finance.loaded = false;
  state.accounts.loaded = false;
  await loadAndRenderFinance();
} else {
  state.accounts.loaded = false;
  await loadAdminData();
  renderAdmin();
}
```

- [ ] **Step 9: Update `deleteItem` — tambah case transfer**

Ganti blok penutup `deleteItem`:

```js
  if (type === 'expense') {
    state.finance.loaded = false;
    state.accounts.loaded = false;
    await loadAndRenderFinance();
  } else if (type === 'transfer') {
    state.accounts.loaded = false;
    await loadAccountsData();
    renderAccounts();
  } else {
    state.accounts.loaded = false;
    await loadAdminData();
    renderAdmin();
  }
  showToast('Data berhasil dihapus.');
```

- [ ] **Step 10: Commit**

```
git add admin.js
git commit -m "feat: tambah data layer rekening ke admin.js"
```

---

## Task 3: Tab + Panel HTML (`admin.html`)

**Files:**
- Modify: `admin.html`

- [ ] **Step 1: Tambah tab button**

Di `<nav class="admin-tabs">`, setelah tombol `data-admin-tab="finance"`:

```html
<button type="button" class="admin-tab" data-admin-tab="accounts">Rekening</button>
```

- [ ] **Step 2: Tambah panel section**

Setelah penutup `</section>` dari `panel-finance` (sebelum `panel-payments`):

```html
<section class="admin-panel" id="panel-accounts">
  <div class="admin-card">
    <div class="admin-card-head">
      <h2>Rekening &amp; Kas</h2>
      <div class="admin-card-actions">
        <button type="button" class="admin-btn admin-btn-light" id="accounts-migrate-btn">Lengkapi Data</button>
        <button type="button" class="admin-btn admin-btn-light" id="accounts-transfer-btn">Catat Transfer</button>
        <button type="button" class="admin-btn admin-btn-primary" data-open-form="account">Tambah Rekening</button>
      </div>
    </div>
  </div>
  <div id="accounts-cards-wrap"></div>
  <div class="admin-card">
    <div class="admin-card-head">
      <h2>Riwayat Transfer</h2>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>Tanggal</th><th>Dari</th><th>Ke</th><th>Nominal</th><th>Catatan</th><th>Aksi</th></tr>
        </thead>
        <tbody id="accounts-transfers-body"></tbody>
      </table>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Verifikasi**

Buka admin di browser → login → tab "Rekening" muncul di navbar → klik → panel muncul tanpa error.

- [ ] **Step 4: Commit**

```
git add admin.html
git commit -m "feat: tambah tab dan panel Rekening ke admin.html"
```

---

## Task 4: Render Accounts Section

**Files:** Modify: admin.js

- [ ] **Step 1: Tambah calcBalance() dan renderAccounts()**

Tambah setelah retryAccountsLoad():


```js
function calcBalance(accountId) {
  const income = state.accounts.allDonors
    .filter(d => d.account_id === accountId)
    .reduce((s, d) => s + Number(d.amount || 0), 0);
  const outcome = state.accounts.allExpenses
    .filter(e => e.account_id === accountId)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const transferIn = state.accounts.transfers
    .filter(t => t.to_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const transferOut = state.accounts.transfers
    .filter(t => t.from_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  return income - outcome + transferIn - transferOut;
}

function renderAccounts() {
  const cardsWrap = document.getElementById('accounts-cards-wrap');
  const transferBody = document.getElementById('accounts-transfers-body');
  if (!state.accounts.loaded && !state.accounts.error) {
    cardsWrap.textContent = '';
    const p = document.createElement('p');
    p.className = 'admin-muted';
    p.textContent = 'Memuat rekening...';
    cardsWrap.appendChild(p);
    transferBody.replaceChildren(); // clear + rebuild with emptyRow
    return;
  }
  if (state.accounts.error) {
    // render error state with retry button using DOM methods
    cardsWrap.textContent = '';
    const div = document.createElement('div');
    div.className = 'admin-warning';
    const strong = document.createElement('strong');
    strong.textContent = 'Data rekening belum dapat dimuat.';
    const p = document.createElement('p');
    p.textContent = state.accounts.error;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-btn admin-btn-light';
    btn.textContent = 'Coba Muat Ulang';
    btn.onclick = retryAccountsLoad;
    div.appendChild(strong); div.appendChild(p); div.appendChild(btn);
    cardsWrap.appendChild(div);
    return;
  }
  renderAccountCards();
  renderTransferTable();
}
```

- [ ] **Step 2: Tambah renderAccountCards() — build DOM tanpa innerHTML**

Lihat spec [docs/superpowers/specs/2026-05-08-rekening-kas-design.md](docs/superpowers/specs/2026-05-08-rekening-kas-design.md) bagian 4 untuk logika kalkulasi saldo. Bangun DOM dengan createElement/appendChild, bukan string HTML, untuk tiap kartu rekening aktif. Kartu "Belum Ditentukan" tampil hanya jika ada data tanpa rekening.

- [ ] **Step 3: Tambah renderTransferTable() dan deactivateAccount()**

```js
function renderTransferTable() {
  const transfers = state.accounts.transfers;
  const accountMap = Object.fromEntries(state.accounts.list.map(a => [a.id, a.name]));
  const tbody = document.getElementById('accounts-transfers-body');
  tbody.replaceChildren();
  if (!transfers.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'admin-empty';
    td.textContent = 'Belum ada transfer antar rekening.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  transfers.forEach(t => {
    const tr = document.createElement('tr');
    [formatDate(t.transfer_date),
     accountMap[t.from_account_id] || '?',
     accountMap[t.to_account_id] || '?',
     formatRupiah(t.amount),
     t.notes || '—'].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    actionTd.innerHTML = rowActions('transfer', t.id); // rowActions is safe — only uses escAttr
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  bindRowActions();
}

async function deactivateAccount(id) {
  const acc = state.accounts.list.find(a => String(a.id) === String(id));
  if (!acc) return;
  if (!confirm('Nonaktifkan rekening "' + acc.name + '"? Rekening tidak akan muncul di dropdown baru, tetapi riwayat transaksi tetap tersimpan.')) return;
  const { error } = await adminDb.from('accounts').update({ is_active: false }).eq('id', id);
  if (error) { showToast(error.message || 'Gagal menonaktifkan rekening.', true); return; }
  await logAdminAction('deactivate', 'accounts', id, { is_active: false });
  const accRes = await adminDb.from('accounts').select('*').order('sort_order', { ascending: true });
  if (!accRes.error) state.accounts.list = accRes.data || [];
  state.accounts.loaded = false;
  await loadAccountsData();
  renderAccounts();
  showToast('Rekening berhasil dinonaktifkan.');
}
```

- [ ] **Step 4: Verifikasi**

Login admin → tab Rekening → loading state muncul → setelah load: area kartu dan tabel transfer kosong tanpa error di console.

- [ ] **Step 5: Commit**

```
git add admin.js
git commit -m "feat: render kartu saldo rekening dan tabel transfer"
```

---

## Task 5: Account CRUD Modal (`admin.js`)

**Files:** Modify: `admin.js` — `modalFieldsHtml`, `buildPayload`, `validatePayload`

- [ ] **Step 1: Tambah form 'account' ke modalFieldsHtml()**

Tambah sebelum `return '';` di akhir fungsi `modalFieldsHtml`:

```js
if (type === 'account') {
  const typeOptions = [['bank', 'Bank'], ['ewallet', 'E-Wallet'], ['cash', 'Kas Tunai']]
    .map(([val, lbl]) =>
      '<option value="' + escAttr(val) + '" ' + (item?.type === val ? 'selected' : '') + '>'
      + escHtml(lbl) + '</option>'
    ).join('');
  return field('Nama Rekening', 'name', 'text', item?.name || '', true)
    + '<label>Tipe<select name="type" required>' + typeOptions + '</select></label>'
    + field('Nomor Rekening', 'account_number', 'text', item?.account_number || '')
    + field('Atas Nama', 'account_holder', 'text', item?.account_holder || '')
    + field('Catatan', 'notes', 'text', item?.notes || '')
    + field('Urutan', 'sort_order', 'number', item?.sort_order ?? 0, true)
    + '<label class="admin-check"><input type="checkbox" name="is_active" '
    + (item?.is_active !== false ? 'checked' : '') + ' /> Aktif</label>';
}
```

- [ ] **Step 2: Tambah buildPayload untuk 'account'**

Tambah sebelum `return {};` di `buildPayload`:

```js
if (type === 'account') {
  return {
    name: clean(form.get('name')),
    type: clean(form.get('type')),
    account_number: clean(form.get('account_number')),
    account_holder: clean(form.get('account_holder')),
    notes: clean(form.get('notes')),
    sort_order: Number(form.get('sort_order') || 0),
    is_active: form.get('is_active') === 'on',
  };
}
```

- [ ] **Step 3: Tambah validatePayload untuk 'account'**

Tambah sebelum `return '';` di `validatePayload`:

```js
if (type === 'account' && (!payload.name || !payload.type)) {
  return 'Nama dan tipe rekening wajib diisi.';
}
```

- [ ] **Step 4: Verifikasi**

Tab Rekening → "Tambah Rekening" → modal dengan Nama, Tipe (Bank/E-Wallet/Kas Tunai), Nomor, Atas Nama, Catatan, Urutan, checkbox Aktif → tambah "BCA Majelis" Bank → kartu muncul saldo Rp 0 → Edit → data terisi kembali.

- [ ] **Step 5: Commit**

```
git add admin.js
git commit -m "feat: CRUD rekening lewat modal admin"
```

---

## Task 6: Transfer Modal (`admin.js`)

**Files:** Modify: `admin.js` — `modalFieldsHtml`, `buildPayload`, `validatePayload`

- [ ] **Step 1: Tambah form 'transfer' ke modalFieldsHtml()**

Tambah sebelum blok `if (type === 'account')`:

```js
if (type === 'transfer') {
  const activeAccounts = state.accounts.list.filter(a => a.is_active);
  const accountOptions = '<option value="" disabled selected>-- Pilih Rekening --</option>'
    + activeAccounts.map(a =>
        '<option value="' + escAttr(a.id) + '">' + escHtml(a.name) + '</option>'
      ).join('');
  return '<label>Dari Rekening<select name="from_account_id" required>' + accountOptions + '</select></label>'
    + '<label>Ke Rekening<select name="to_account_id" required>' + accountOptions + '</select></label>'
    + field('Nominal (Rp)', 'amount', 'number', '', true, '1000')
    + field('Tanggal', 'transfer_date', 'date', today(), true)
    + '<label>Catatan<textarea name="notes" rows="2"></textarea></label>';
}
```

- [ ] **Step 2: Tambah buildPayload untuk 'transfer'**

Tambah sebelum blok `if (type === 'account')`:

```js
if (type === 'transfer') {
  return {
    from_account_id: clean(form.get('from_account_id')),
    to_account_id: clean(form.get('to_account_id')),
    amount: Number(form.get('amount')),
    transfer_date: clean(form.get('transfer_date')),
    notes: clean(form.get('notes')),
  };
}
```

- [ ] **Step 3: Tambah validatePayload untuk 'transfer'**

Tambah sebelum blok `if (type === 'account')`:

```js
if (type === 'transfer') {
  if (!payload.from_account_id || !payload.to_account_id || payload.amount <= 0 || !payload.transfer_date) {
    return 'Dari rekening, ke rekening, nominal, dan tanggal wajib diisi.';
  }
  if (payload.from_account_id === payload.to_account_id) {
    return 'Rekening asal dan tujuan tidak boleh sama.';
  }
}
```

- [ ] **Step 4: Verifikasi**

Tab Rekening (min 2 rekening) → "Catat Transfer" → modal dropdown Dari/Ke, Nominal, Tanggal → isi BCA ke Kas Tunai Rp 500.000 → Simpan → muncul di tabel → saldo BCA -500rb, saldo Kas Tunai +500rb.

- [ ] **Step 5: Commit**

```
git add admin.js
git commit -m "feat: modal catat transfer antar rekening"
```

---

## Task 7: Dropdown Rekening di Modal Donor & Expense (`admin.js`)

**Files:** Modify: `admin.js` — `modalFieldsHtml` (donor & expense), `buildPayload` (donor & expense)

- [ ] **Step 1: Update form donor di modalFieldsHtml()**

Ganti seluruh blok `if (type === 'donor') { return ...; }` dengan versi yang menyertakan dropdown rekening di akhir:

```js
if (type === 'donor') {
  const donorAccOpts = state.accounts.list
    .filter(a => a.is_active)
    .map(a => '<option value="' + escAttr(a.id) + '" '
      + (item?.account_id === a.id ? 'selected' : '') + '>'
      + escHtml(a.name) + '</option>')
    .join('');
  return field('Nama Donatur', 'name', 'text', item?.name || 'Hamba Allah', true)
    + field('Nominal', 'amount', 'number', item?.amount || '', true, '1000')
    + field('Tanggal', 'donation_date', 'date', item?.donation_date || today(), true)
    + '<label class="admin-check"><input type="checkbox" name="is_anonymous" '
    + (item?.is_anonymous ? 'checked' : '') + ' /> Tampilkan sebagai Hamba Allah</label>'
    + '<label>Catatan<textarea name="notes" rows="3">' + escHtml(item?.notes || '') + '</textarea></label>'
    + '<label>Masuk ke Rekening<select name="account_id" ' + (!item ? 'required' : '') + '>'
    + '<option value="">-- Belum Ditentukan --</option>' + donorAccOpts + '</select></label>';
}
```

- [ ] **Step 2: Tambah account_id ke buildPayload donor**

Pada blok `if (type === 'donor') { return { ... }; }`, tambah field:

```js
account_id: clean(form.get('account_id')) || null,
```

- [ ] **Step 3: Update form expense di modalFieldsHtml()**

Ganti seluruh blok `if (type === 'expense') { return ...; }` dengan versi yang menyertakan dropdown rekening di akhir:

```js
if (type === 'expense') {
  const rabCats = state.finance.categories.filter(c => c.breakdown_id);
  const customCats = state.finance.categories.filter(c => !c.breakdown_id);
  const rabOptions = rabCats.map(c =>
    '<option value="' + escAttr(c.id) + '" ' + (item?.category_id === c.id ? 'selected' : '') + '>'
    + escHtml(c.name) + '</option>'
  ).join('');
  const customOptions = customCats.map(c =>
    '<option value="' + escAttr(c.id) + '" ' + (item?.category_id === c.id ? 'selected' : '') + '>'
    + escHtml(c.name) + '</option>'
  ).join('');
  const expAccOpts = state.accounts.list
    .filter(a => a.is_active)
    .map(a => '<option value="' + escAttr(a.id) + '" '
      + (item?.account_id === a.id ? 'selected' : '') + '>'
      + escHtml(a.name) + '</option>')
    .join('');
  return field('Tanggal Pengeluaran', 'expense_date', 'date', item?.expense_date || today(), true)
    + field('Nominal (Rp)', 'amount', 'number', item?.amount || '', true, '1000')
    + '<label>Kategori<select name="category_id" required>'
    + '<option value="" disabled ' + (!item ? 'selected' : '') + '>-- Pilih Kategori --</option>'
    + (rabOptions ? '<optgroup label="Dari Pos RAB">' + rabOptions + '</optgroup>' : '')
    + (customOptions ? '<optgroup label="Kategori Kustom">' + customOptions + '</optgroup>' : '')
    + '</select></label>'
    + field('Keterangan', 'description', 'text', item?.description || '', true)
    + '<label>Catatan<textarea name="notes" rows="3">' + escHtml(item?.notes || '') + '</textarea></label>'
    + '<label>Keluar dari Rekening<select name="account_id" ' + (!item ? 'required' : '') + '>'
    + '<option value="">-- Belum Ditentukan --</option>' + expAccOpts + '</select></label>';
}
```

- [ ] **Step 4: Tambah account_id ke buildPayload expense**

Pada blok `if (type === 'expense') { return { ... }; }`, tambah field:

```js
account_id: clean(form.get('account_id')) || null,
```

- [ ] **Step 5: Verifikasi**

Tab Donatur → Tambah Donatur → dropdown "Masuk ke Rekening" muncul (required untuk data baru) → simpan dengan rekening → tab Rekening: saldo bertambah.

Tab Lap. Keuangan → Tambah Pengeluaran → dropdown "Keluar dari Rekening" muncul (required untuk data baru) → simpan → tab Rekening: saldo berkurang.

- [ ] **Step 6: Commit**

```
git add admin.js
git commit -m "feat: dropdown rekening di modal donor dan expense"
```

---

## Task 8: Modal Lengkapi Data — Migrasi Data Lama (`admin.js`)

**Files:** Modify: `admin.js` — tambah `openMigrateModal`, `migrateModalHtml`, `bindMigrateTabEvents`, `saveMigrateData`

- [ ] **Step 1: Tambah openMigrateModal()**

Tambah setelah `handleCategoryAdd()`:

```js
async function openMigrateModal() {
  state.modalType = 'migrate-accounts';
  state.editingId = null;
  modalTitle.textContent = 'Lengkapi Data Rekening';
  modalFields.textContent = '';
  const loading = document.createElement('p');
  loading.className = 'admin-muted';
  loading.textContent = 'Memuat data...';
  modalFields.appendChild(loading);
  modal.showModal();
  try {
    const [donorsRes, expensesRes] = await Promise.all([
      adminDb.from('donors')
        .select('id, name, amount, donation_date, is_anonymous')
        .is('account_id', null)
        .order('donation_date', { ascending: false }),
      adminDb.from('expenses')
        .select('id, description, amount, expense_date')
        .is('account_id', null)
        .order('expense_date', { ascending: false }),
    ]);
    if (donorsRes.error) throw donorsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    modalFields.innerHTML = migrateModalHtml(donorsRes.data || [], expensesRes.data || []);
    bindMigrateTabEvents();
  } catch (error) {
    modalFields.textContent = '';
    const p = document.createElement('p');
    p.className = 'admin-muted';
    p.textContent = 'Gagal memuat data: ' + error.message;
    modalFields.appendChild(p);
  }
}
```

- [ ] **Step 2: Tambah migrateModalHtml()**

`migrateModalHtml` membangun string HTML tabel dari data donors/expenses yang belum punya rekening. Setiap baris berisi dropdown pilih rekening. Gunakan `escHtml`/`escAttr` untuk semua data user.

```js
function migrateModalHtml(donors, expenses) {
  const accountOptions = state.accounts.list
    .filter(a => a.is_active)
    .map(a => '<option value="' + escAttr(a.id) + '">' + escHtml(a.name) + '</option>')
    .join('');

  function makeSelect(id, type) {
    return '<select class="migrate-select" data-id="' + escAttr(id) + '" data-type="' + type + '">'
      + '<option value="">-- Pilih --</option>' + accountOptions + '</select>';
  }

  const donorRows = donors.map(d =>
    '<tr><td>' + escHtml(formatDate(d.donation_date)) + '</td>'
    + '<td>' + escHtml(d.is_anonymous ? 'Hamba Allah' : d.name) + '</td>'
    + '<td>' + escHtml(formatRupiah(d.amount)) + '</td>'
    + '<td>' + makeSelect(d.id, 'donor') + '</td></tr>'
  ).join('') || '<tr><td colspan="4" class="admin-empty">Semua pemasukan sudah memiliki rekening.</td></tr>';

  const expenseRows = expenses.map(e =>
    '<tr><td>' + escHtml(formatDate(e.expense_date)) + '</td>'
    + '<td>' + escHtml(e.description) + '</td>'
    + '<td>' + escHtml(formatRupiah(e.amount)) + '</td>'
    + '<td>' + makeSelect(e.id, 'expense') + '</td></tr>'
  ).join('') || '<tr><td colspan="4" class="admin-empty">Semua pengeluaran sudah memiliki rekening.</td></tr>';

  return '<div style="margin-bottom:12px">'
    + '<button type="button" class="admin-btn admin-btn-light migrate-tab-btn active" data-migrate-tab="pemasukan">Pemasukan (' + donors.length + ')</button>'
    + ' <button type="button" class="admin-btn admin-btn-light migrate-tab-btn" data-migrate-tab="pengeluaran">Pengeluaran (' + expenses.length + ')</button>'
    + '</div>'
    + '<div id="migrate-tab-pemasukan"><div class="admin-table-wrap" style="max-height:320px;overflow-y:auto">'
    + '<table class="admin-table"><thead><tr><th>Tanggal</th><th>Nama</th><th>Nominal</th><th>Rekening</th></tr></thead>'
    + '<tbody>' + donorRows + '</tbody></table></div></div>'
    + '<div id="migrate-tab-pengeluaran" hidden><div class="admin-table-wrap" style="max-height:320px;overflow-y:auto">'
    + '<table class="admin-table"><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Nominal</th><th>Rekening</th></tr></thead>'
    + '<tbody>' + expenseRows + '</tbody></table></div></div>'
    + '<p class="admin-muted" style="margin-top:8px;font-size:12px">Pilih rekening untuk setiap baris, lalu klik Simpan.</p>';
}
```

- [ ] **Step 3: Tambah bindMigrateTabEvents() dan saveMigrateData()**

```js
function bindMigrateTabEvents() {
  modalFields.querySelectorAll('.migrate-tab-btn').forEach(btn => {
    btn.onclick = () => {
      modalFields.querySelectorAll('.migrate-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isPemasukan = btn.dataset.migrateTab === 'pemasukan';
      document.getElementById('migrate-tab-pemasukan').hidden = !isPemasukan;
      document.getElementById('migrate-tab-pengeluaran').hidden = isPemasukan;
    };
  });
}

async function saveMigrateData() {
  const selects = modalFields.querySelectorAll('.migrate-select');
  const donorUpdates = [];
  const expenseUpdates = [];
  selects.forEach(sel => {
    if (!sel.value) return;
    if (sel.dataset.type === 'donor') {
      donorUpdates.push({ id: sel.dataset.id, account_id: sel.value });
    } else {
      expenseUpdates.push({ id: sel.dataset.id, account_id: sel.value });
    }
  });
  if (donorUpdates.length === 0 && expenseUpdates.length === 0) {
    showToast('Pilih rekening untuk setidaknya satu data terlebih dahulu.', true);
    return;
  }
  try {
    for (const { id, account_id } of donorUpdates) {
      const { error } = await adminDb.from('donors').update({ account_id }).eq('id', id);
      if (error) throw error;
    }
    for (const { id, account_id } of expenseUpdates) {
      const { error } = await adminDb.from('expenses').update({ account_id }).eq('id', id);
      if (error) throw error;
    }
    await logAdminAction('bulk_assign', 'accounts', null, {
      donors: donorUpdates.length, expenses: expenseUpdates.length,
    });
    closeModal();
    state.accounts.loaded = false;
    await loadAccountsData();
    renderAccounts();
    showToast((donorUpdates.length + expenseUpdates.length) + ' data berhasil diassign ke rekening.');
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan data rekening.', true);
  }
}
```

- [ ] **Step 4: Verifikasi end-to-end**

1. Tab Rekening → "Lengkapi Data" → modal muncul dengan tab Pemasukan & Pengeluaran
2. Tab Pemasukan: donasi lama tanpa rekening tampil dalam tabel
3. Pilih rekening untuk beberapa baris → klik Simpan (footer modal)
4. Modal tutup → toast sukses → kartu "Belum Ditentukan" berkurang/hilang
5. Saldo rekening yang dipilih bertambah sesuai total donasi yang diassign

- [ ] **Step 5: Commit**

```
git add admin.js
git commit -m "feat: modal Lengkapi Data untuk migrasi rekening data lama"
```

---

## Spec Coverage

| Requirement | Task |
|---|---|
| Tabel `accounts` & `account_transfers` | Task 1 |
| Kolom `account_id` di `donors` & `expenses` | Task 1 |
| RLS policies | Task 1 |
| Admin bisa tambah rekening sendiri (bank/ewallet/cash) | Task 5 |
| Kas Tunai sebagai tipe rekening | Task 5 |
| Saldo per rekening dihitung otomatis | Task 4 (`calcBalance`) |
| Transfer antar rekening | Task 6 |
| Dropdown rekening di modal donor | Task 7 |
| Dropdown rekening di modal expense | Task 7 |
| Kartu "Belum Ditentukan" (masuk & keluar terpisah) | Task 4 |
| Modal migrasi data lama | Task 8 |
| Nonaktifkan rekening (soft delete) | Task 4 (`deactivateAccount`) |
| Hanya tampil di admin | Tidak ada perubahan di laporan/index |
