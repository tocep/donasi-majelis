# Panduan Setup Supabase Admin

Panduan ini dipakai untuk mengaktifkan backend, database, login admin, dan upload gambar.

## 1. Buat Project Supabase

1. Buat project baru di Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `docs/planning/supabase-schema.sql`.
4. Pastikan bucket `donasi-assets` sudah muncul di Storage dan bersifat public.

Untuk project yang sudah berjalan dan hanya perlu menaikkan akses admin ke RLS, jalankan `docs/planning/admin-users-rls-migration.sql`.

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
3. Tambahkan user dengan email dan password panitia. SQL bawaan akan menjadikan `panitia@majelis.org` sebagai admin awal jika user itu ada; jika tidak, user Auth paling lama akan dijadikan admin awal.
4. Jika email admin awal berbeda, jalankan SQL berikut setelah mengganti emailnya:

```sql
insert into public.admin_users (user_id, email, role, is_active)
select id, email, 'admin', true
from auth.users
where lower(email) = lower('email-admin@contoh.org')
on conflict (user_id) do update
set email = excluded.email,
    role = 'admin',
    is_active = true;
```

5. Login melalui `admin.html`.

Catatan: hanya user Auth yang punya baris aktif di `public.admin_users` yang bisa membuka dashboard dan mengubah data.

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
- Nonaktifkan akses admin dengan mengubah `public.admin_users.is_active` menjadi `false`.
- Data publik seperti daftar donatur memang dapat dibaca pengunjung karena ditampilkan di website.
