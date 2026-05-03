# Website Donasi Majelis Nuruzh Zholam

Website statis untuk publikasi donasi pembangunan Majelis Nuruzh Zholam.

## Struktur

- `index.html` - halaman publik donasi.
- `admin.html` - panel panitia untuk update data melalui Supabase.
- `style.css` - styling halaman publik dan admin.
- `script.js` - logika halaman publik.
- `admin.js` - logika panel admin.
- `utils.js` - helper bersama untuk format Rupiah, escaping HTML, dan toast.
- `supabase-config.js` - konfigurasi koneksi Supabase.
- `analytics.js` - analytics ringan yang nonaktif secara default.
- `docs/planning/` - dokumentasi perencanaan, operasional, dan publikasi.

## Menjalankan Lokal

Buka `index.html` langsung di browser, atau jalankan server statis:

```bash
python3 -m http.server 4173
```

Lalu buka:

```text
http://127.0.0.1:4173/index.html
```

## Publikasi GitHub Pages

1. Buat repository baru di GitHub.
2. Hubungkan repository lokal:

```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
```

3. Push branch utama:

```bash
git branch -M main
git push -u origin main
```

4. Di GitHub, buka `Settings` -> `Pages`.
5. Pada `Build and deployment`, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
6. Simpan dan tunggu URL GitHub Pages aktif.

## Domain

Jika domain tersedia, arahkan domain ke GitHub Pages melalui menu `Settings` -> `Pages` -> `Custom domain`. Setelah domain aktif, update nilai `og:url` di `index.html` agar preview WhatsApp dan media sosial memakai alamat resmi.

## Admin

Admin login memakai Supabase Auth, lalu aksesnya divalidasi lewat tabel `public.admin_users`.
Jalankan `docs/planning/supabase-schema.sql` di Supabase SQL Editor untuk membuat tabel admin dan RLS.
Untuk project yang sudah terlanjur berjalan, jalankan `docs/planning/admin-users-rls-migration.sql`.

## Tes

Jalankan regresi statis:

```bash
node --test tests/static-regression.test.mjs
```

## Analytics

`analytics.js` sudah terpasang di `index.html`, tetapi tidak mengirim data apa pun sebelum dikonfigurasi. Untuk mengaktifkan analytics ringan, isi konfigurasi `window.DONASI_ANALYTICS` sebelum `analytics.js` dimuat, misalnya untuk endpoint internal atau layanan analytics yang dipilih panitia.
# donasi-majelis
