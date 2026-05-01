# Panduan Setup Supabase Admin

Panduan ini dipakai untuk mengaktifkan backend, database, login admin, dan upload gambar.

## 1. Buat Project Supabase

1. Buat project baru di Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `docs/planning/supabase-schema.sql`.
4. Pastikan bucket `donasi-assets` sudah muncul di Storage dan bersifat public.

## 2. Isi Konfigurasi Frontend

Buka `supabase-config.js`, lalu isi:

```js
const SUPABASE_CONFIG = {
  url: 'https://PROJECT-ID.supabase.co',
  anonKey: 'ANON-KEY-DARI-SUPABASE',
  storageBucket: 'donasi-assets',
};
```

Gunakan hanya `anon public key`. Jangan pernah menaruh `service_role key` di frontend.

## 3. Buat Akun Admin Panitia

1. Buka Supabase Dashboard.
2. Masuk ke Authentication > Users.
3. Tambahkan user dengan email dan password panitia.
4. Login melalui `admin.html`.

Catatan: versi pertama ini memakai semua user authenticated sebagai admin. Jangan buka pendaftaran publik di Supabase Auth.

## 4. Cara Update Data

1. Buka `admin.html`.
2. Login dengan akun panitia.
3. Isi data di tab:
   - Profil Majelis
   - Laporan Dana
   - Metode Donasi
   - Kontak
   - Donatur
   - Update Pembangunan
   - Galeri
4. Buka `index.html` untuk mengecek tampilan publik.

## 5. Catatan Keamanan

- Aktifkan Row Level Security memakai SQL yang disediakan.
- Jangan membagikan akun admin ke pihak luar panitia.
- Jika butuh role bendahara/editor berbeda, tambahkan tabel role admin pada pengembangan berikutnya.
- Data publik seperti daftar donatur memang dapat dibaca pengunjung karena ditampilkan di website.
