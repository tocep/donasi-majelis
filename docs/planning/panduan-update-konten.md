# Panduan Update Konten Website Donasi

Dokumen ini dipakai saat panitia atau developer perlu memperbarui data website.

## 1. Metode Update Utama

Setelah Tahap 3, data utama website diperbarui melalui:

- `admin.html`

Admin harus login memakai akun panitia yang dibuat di Supabase Auth. Perubahan yang disimpan dari halaman admin akan masuk ke database Supabase dan dibaca oleh website publik.

Sebelum dipakai, pastikan:

- `supabase-config.js` sudah berisi URL dan anon key Supabase.
- SQL di `docs/planning/supabase-schema.sql` sudah dijalankan.
- Akun admin panitia sudah dibuat di Supabase Auth.

## 2. Data Yang Bisa Diedit Dari Admin

- Profil majelis: nama, alamat, program, foto majelis, dan pesan WhatsApp.
- Laporan dana: target donasi, dana terpakai, tanggal laporan, catatan laporan, dan QRIS.
- Metode donasi: rekening bank dan e-wallet.
- Kontak panitia.
- Update pembangunan.
- Galeri foto.
- Daftar donatur.

## 3. Mengisi Metode Donasi

Masuk ke `admin.html`, buka tab **Metode Donasi**, lalu tambah atau edit rekening bank/e-wallet.

Isi:

- Tipe: `Bank` atau `E-Wallet`.
- Kode: contoh `bca`, `mandiri`, `gopay`, `dana`.
- Label: contoh `BCA`, `MDR`, `G`, `D`.
- Nama metode: contoh `Bank BCA` atau `DANA`.
- Nomor rekening/akun.
- Atas nama.
- Status aktif.

Sebelum publish, pastikan nomor dan nama pemilik rekening sudah diverifikasi oleh panitia.

## 4. Mengisi Kontak WhatsApp

Masuk ke tab **Kontak**, lalu isi nama, jabatan, dan nomor WhatsApp panitia.

Format nomor WhatsApp wajib memakai kode negara tanpa tanda plus.

Format benar:

- `6281234567890`

Format yang perlu dihindari:

- `081234567890`
- `+6281234567890`
- `62 812 3456 7890`

## 5. Mengubah Target Donasi dan Laporan Dana

Masuk ke tab **Laporan Dana**, lalu isi:

- Target donasi.
- Dana terpakai.
- Tanggal laporan.
- Catatan laporan.
- URL QRIS atau upload gambar QRIS.

Website akan menghitung otomatis:

- Dana masuk tercatat dari daftar donatur.
- Dana terpakai.
- Saldo tercatat.
- Sisa target.

## 6. Menambah Donatur

Masuk ke tab **Donatur**, lalu klik tambah donatur.

Aturan:

- Nominal ditulis angka saja.
- Tanggal dipilih dari input admin.
- Jika donatur ingin anonim, gunakan `Hamba Allah` atau `Anonim`.

Catatan: total progress donasi dihitung otomatis dari daftar donatur.

## 7. Menambah Update Pembangunan

Masuk ke tab **Update Pembangunan**, lalu isi tanggal, judul, dan deskripsi progres.

Update terbaru akan tampil di bagian atas secara otomatis.

## 8. Mengganti QRIS dan Foto Galeri

QRIS dapat diganti dari tab **Laporan Dana**.

Foto galeri dapat ditambah atau diedit dari tab **Galeri**.

Gambar akan diupload ke Supabase Storage bucket `donasi-assets`.

## 9. Checklist Setelah Update

- [ ] Website dibuka ulang di browser.
- [ ] Tidak ada nomor rekening yang salah.
- [ ] Tombol salin menyalin nomor yang benar.
- [ ] Link WhatsApp membuka chat ke nomor yang benar.
- [ ] QRIS tampil dan bisa discan.
- [ ] Foto galeri tampil.
- [ ] Progress donasi sesuai daftar donatur.
- [ ] Laporan dana dan update pembangunan tampil benar.
- [ ] Tidak ada data penting yang masih kosong sebelum publikasi.

## 10. Catatan Untuk Developer

Sebelum Tahap 3, data pernah diedit langsung di `script.js`. Cara itu tidak lagi menjadi metode utama.

Jika Supabase belum dikonfigurasi, website publik akan menampilkan pesan bahwa data belum dapat dimuat, bukan menampilkan data dummy sebagai data resmi.
