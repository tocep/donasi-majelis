# Rencana Pengembangan Lanjutan

Dokumen ini berisi saran pengembangan hasil review menyeluruh terhadap codebase website donasi Majelis Nuruzh Zholam.

Dibuat: 1 Mei 2026.

---

## Ringkasan Kondisi Saat Ini

Stack: Vanilla HTML/CSS/JS + Supabase (auth, database, storage) + GitHub Pages.

Tabel database aktif: `site_settings`, `payment_methods`, `contacts`, `donors`, `building_updates`, `gallery_items`.

Yang sudah berjalan baik:

- Kode bersih dan terstruktur
- XSS protection via `escHtml`/`escAttr` di semua render dinamis
- Admin panel CRUD lengkap dengan autentikasi Supabase
- Row Level Security (RLS) terkonfigurasi dengan benar
- Timeout handler untuk query lambat
- Aksesibilitas dasar (aria attributes, keyboard navigation, lightbox)
- Responsive mobile-first

---

## P0 — Wajib Sebelum Website Dibagikan

### 1. Tambahkan og:image untuk preview link WhatsApp

`index.html` sudah memiliki `og:title` dan `og:description`, tetapi belum ada `og:image`. Link yang dibagikan via WhatsApp akan tampil tanpa gambar preview dan kurang menarik.

Solusi: Tambahkan tag berikut di `<head>` setelah tag og yang sudah ada.

```html
<meta property="og:image" content="https://domain.com/images/og-cover.jpg" />
<meta property="og:url" content="https://domain.com" />
```

File referensi: `index.html` baris 8–11.

---

### 2. Perbaiki bug escAttr pada gallery di admin

Di `admin.js` baris 390, URL gambar galeri dirender menggunakan `escAttr` yang menghapus semua karakter selain `a-z0-9._-`. Akibatnya karakter `https://`, `/`, dan `?` terhapus sehingga gambar tidak tampil.

Solusi: Ganti `escAttr(item.image_url)` dan `escAttr(item.caption)` pada fungsi `renderGallery` dengan `escHtml`.

```js
// Sebelum (admin.js ~390)
<img src="${escAttr(item.image_url)}" alt="${escAttr(item.caption)}" />

// Sesudah
<img src="${escHtml(item.image_url)}" alt="${escHtml(item.caption)}" />
```

---

### 3. Deduplikasi fungsi utility ke utils.js

Fungsi `formatRupiah`, `escHtml`, `escAttr`, dan `showToast` didefinisikan dua kali — satu di `script.js` dan satu di `admin.js`. Jika salah satu diubah, yang lain tidak ikut berubah dan rentan inkonsistensi.

Solusi: Buat file baru `utils.js`, pindahkan fungsi-fungsi tersebut ke sana, lalu muat file ini sebelum `script.js` dan `admin.js` di masing-masing HTML.

---

## P1 — Kepercayaan Donatur

### 4. Form konfirmasi donasi mandiri oleh donatur

Alur saat ini: donatur transfer → WA ke panitia → panitia entry manual. Ini bergantung sepenuhnya pada keaktifan panitia dan rawan data yang tidak tercatat.

Solusi: Tambahkan form konfirmasi di halaman publik. Donatur mengisi nama, nominal, tanggal, dan nomor WhatsApp, lalu upload bukti transfer. Data masuk ke tabel baru `pending_confirmations` dengan status `pending`. Panitia verifikasi di admin dan memindahkan ke tabel `donors`.

Skema tabel tambahan:

```sql
create table public.pending_confirmations (
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
```

---

### 5. Field is_anonymous dan notes pada tabel donors

Beberapa donatur mungkin ingin tampil sebagai "Hamba Allah" tanpa panitia harus mengedit nama secara manual setiap kali.

Solusi: Tambahkan dua kolom pada tabel `donors`.

```sql
alter table public.donors
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists notes text not null default '';
```

Di `script.js`, ubah render nama donatur:

```js
const nama = d.is_anonymous ? 'Hamba Allah' : (d.nama || 'Hamba Allah');
```

---

### 6. Rincian kebutuhan dana (breakdown RAB)

Menampilkan rincian anggaran (pondasi, atap, dinding, dll.) sangat meningkatkan kepercayaan calon donatur karena mereka bisa melihat dana digunakan untuk apa.

Solusi: Tambahkan tabel `fund_breakdown`.

```sql
create table public.fund_breakdown (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric not null check (amount >= 0),
  sort_order integer not null default 0
);
```

Tampilkan di section Transparansi Dana di bawah ringkasan dana.

---

### 7. Badge verifikasi rekening resmi

Tambahkan kolom `verified_at date` pada tabel `payment_methods`. Tampilkan teks kecil di bawah setiap rekening: *"Diverifikasi panitia per [tanggal]"*. Ini membantu donatur yakin rekening tidak dipalsukan.

---

## P2 — Fitur Admin yang Belum Ada

### 8. Pagination dan pencarian donatur di admin

Jika donatur sudah ratusan, tabel admin akan sangat lambat. Perlu ditambahkan pencarian nama dan pagination.

Solusi: Gunakan `.ilike()` dan `.range()` dari Supabase.

```js
adminDb
  .from('donors')
  .select('*', { count: 'exact' })
  .ilike('name', `%${keyword}%`)
  .order('donation_date', { ascending: false })
  .range(offset, offset + 19);
```

---

### 9. Export CSV donatur

Panitia sering butuh laporan untuk rapat atau laporan kegiatan ke pengurus majelis. Tambahkan tombol "Export CSV" di panel donors.

Implementasi sederhana (tidak butuh library):

```js
function exportDonorsCsv() {
  const rows = [['Nama', 'Nominal', 'Tanggal']];
  state.donors.forEach(d => rows.push([d.name, d.amount, d.donation_date]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `donatur-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}
```

---

### 10. Audit log perubahan admin

Semua operasi admin saat ini tidak terekam. Jika ada data yang berubah atau terhapus tanpa sengaja, tidak ada jejak.

Skema tabel:

```sql
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  table_name text not null,
  record_id text,
  admin_email text,
  payload jsonb,
  created_at timestamptz not null default now()
);
```

Tambahkan RLS: hanya `authenticated` bisa baca, tidak ada yang bisa hapus dari frontend.

---

### 11. Bulk import donatur via CSV

Memungkinkan panitia import ratusan donatur dari file Excel yang diekspor sebagai CSV, tanpa harus entry satu per satu.

Solusi: Tambahkan input `<input type="file" accept=".csv">` di panel donors admin, parse CSV di JavaScript, lalu gunakan `adminDb.from('donors').insert(rows)`.

---

## P3 — Peningkatan Teknis

### 12. Real-time update progress donasi

Supabase mendukung subscription real-time. Pengunjung yang sedang membuka halaman akan langsung melihat progress bar bergerak tanpa harus refresh halaman.

```js
db.channel('donors-realtime')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'donors'
  }, () => {
    loadPublicData().then(renderPublicPage);
  })
  .subscribe();
```

File referensi: `script.js` fungsi `loadPublicData`.

---

### 13. Service Worker / PWA dasar

Tambahkan `manifest.json` dan service worker sederhana agar website bisa diakses offline (menampilkan data cache terakhir) dan bisa di-"Add to Home Screen" dari browser HP jamaah.

File yang perlu dibuat: `manifest.json`, `sw.js`.
Tambahkan di `index.html`:
```html
<link rel="manifest" href="manifest.json" />
<script>
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
</script>
```

---

### 14. Batasi akses admin hanya ke email tertentu

Saat ini semua akun Supabase Auth yang valid bisa login ke `/admin.html`. Ini berisiko jika ada akun yang tidak sengaja terdaftar.

Solusi minimal di `admin.js`:

```js
const ALLOWED_ADMINS = ['panitia@majelis.org'];

async function showDashboard() {
  const { data: { session } } = await adminDb.auth.getSession();
  if (!ALLOWED_ADMINS.includes(session?.user?.email)) {
    await adminDb.auth.signOut();
    showLogin();
    loginStatus.textContent = 'Akun ini tidak memiliki akses admin.';
    return;
  }
  // lanjut render dashboard
}
```

Solusi lebih kuat: gunakan custom claims di Supabase Auth atau tabel `admin_users`.

---

### 15. Validasi ukuran file dan transformasi gambar

Upload gambar saat ini tidak membatasi ukuran file. Jika panitia upload foto 10 MB, halaman publik akan sangat lambat di HP.

Solusi:
- Tambahkan validasi di `uploadAsset`: `if (file.size > 3 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 3 MB.')`
- Gunakan Supabase Image Transformation untuk URL galeri publik: tambahkan `?width=800&quality=80` pada `image_url` saat di-render di `script.js`

---

## P4 — Pengembangan Jangka Panjang

### 16. Section FAQ di halaman publik

Sudah direncanakan di dokumen sebelumnya tetapi belum diimplementasi. Pertanyaan yang perlu dijawab:

- Apakah donasi bisa anonim?
- Bagaimana konfirmasi setelah transfer?
- Kapan nama donatur muncul di website?
- Di mana laporan penggunaan dana bisa dilihat?
- Siapa yang bertanggung jawab atas pengelolaan dana?

---

### 17. Tombol share WhatsApp untuk halaman

Tombol "Bagikan ke WhatsApp" yang membuka WA dengan teks otomatis berisi link website dan progress donasi terkini. Mudah viral di komunitas jamaah.

```js
const shareText = `Bantu pembangunan Majelis Nuruzh Zholam. Sudah terkumpul ${formatRupiah(terkumpul)} dari target ${formatRupiah(target)}. Yuk berdonasi: https://domain.com`;
const href = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
```

---

### 18. Notifikasi ke panitia saat ada konfirmasi donasi baru

Manfaatkan Supabase Edge Functions dan Supabase Database Webhooks untuk mengirim notifikasi ke nomor WhatsApp atau email panitia setiap ada baris baru masuk ke `pending_confirmations`. Panitia tidak perlu cek admin setiap hari.

---

### 19. Halaman laporan publik terpisah

Buat `laporan.html` yang hanya menampilkan tabel laporan keuangan dan riwayat penggunaan dana, bisa dicetak, dan bisa dibagikan saat rapat jamaah tanpa semua bagian donasi.

---

### 20. Laporan rekap bulanan

Tampilkan chart sederhana (bisa dengan canvas native atau library ringan seperti Chart.js) yang memperlihatkan tren donasi per bulan. Ini membantu panitia melihat momentum kampanye dan menyiapkan laporan kepada jamaah.

---

## Tabel Prioritas Eksekusi

| # | Item | Dampak | Effort | Urgensi |
|---|------|--------|--------|---------|
| 2 | Perbaiki bug escAttr gallery admin | Tinggi | Rendah | Segera |
| 1 | og:image untuk preview WhatsApp | Tinggi | Rendah | Segera |
| 3 | Deduplikasi utils ke utils.js | Medium | Rendah | Segera |
| 14 | Whitelist email admin | Tinggi | Rendah | Sebelum rilis |
| 15 | Validasi ukuran upload gambar | Medium | Rendah | Sebelum rilis |
| 9 | Export CSV donatur | Tinggi | Rendah | Jangka pendek |
| 8 | Pagination & search admin donors | Tinggi | Medium | Jangka pendek |
| 5 | Field is_anonymous & notes donors | Medium | Rendah | Jangka pendek |
| 12 | Real-time progress donasi | Medium | Rendah | Jangka menengah |
| 4 | Form konfirmasi donasi mandiri | Sangat Tinggi | Tinggi | Jangka menengah |
| 6 | Rincian kebutuhan dana (RAB) | Tinggi | Medium | Jangka menengah |
| 10 | Audit log perubahan admin | Medium | Medium | Jangka menengah |
| 11 | Bulk import donatur via CSV | Medium | Medium | Jangka panjang |
| 13 | PWA / Service Worker | Medium | Medium | Jangka panjang |
| 17 | Tombol share WhatsApp | Medium | Rendah | Jangka panjang |
| 16 | Section FAQ | Medium | Rendah | Jangka panjang |
| 7 | Badge verifikasi rekening | Medium | Rendah | Jangka panjang |
| 18 | Notifikasi panitia otomatis | Tinggi | Tinggi | Jangka panjang |
| 19 | Halaman laporan publik | Medium | Medium | Jangka panjang |
| 20 | Chart rekap bulanan | Rendah | Medium | Jangka panjang |

---

## Catatan Arsitektur

Website ini tidak perlu berpindah ke framework seperti React atau Next.js selama kebutuhan masih seperti sekarang. Vanilla JS dengan Supabase sudah mampu memenuhi semua saran di atas.

Pertimbangkan framework baru hanya jika:

- Ada lebih dari satu orang developer yang bekerja bersamaan pada codebase
- Dibutuhkan routing halaman yang kompleks
- Dibutuhkan state management yang lebih dari sekedar objek `DATA` dan `state`
- Performa render menjadi bottleneck nyata karena data sangat banyak

Untuk sekarang: **jaga tetap sederhana, tambah fitur satu per satu, uji di HP sebelum rilis**.
