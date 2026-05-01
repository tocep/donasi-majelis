# Publikasi Profesional

Dokumen ini menjelaskan langkah publikasi Tahap 4 untuk website donasi.

## Tujuan

Website memiliki alamat publik yang stabil, mudah dibagikan, dan bisa dikelola dengan riwayat perubahan yang jelas.

## Pilihan Hosting

Rekomendasi utama: GitHub Pages.

Alasan:

- Website berbasis HTML, CSS, dan JavaScript statis.
- Tidak membutuhkan proses build.
- Gratis untuk kebutuhan publikasi sederhana.
- Terintegrasi langsung dengan Git repository.

## Langkah Setup GitHub Pages

1. Pastikan semua data publik sudah benar.
2. Buat repository baru di GitHub.
3. Hubungkan repository lokal ke GitHub:

```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
```

4. Push branch utama:

```bash
git branch -M main
git push -u origin main
```

5. Buka `Settings` -> `Pages`.
6. Pilih `Deploy from a branch`.
7. Pilih branch `main` dan folder `/ (root)`.
8. Simpan konfigurasi.
9. Tunggu GitHub menerbitkan URL website.

## Domain

Jika domain resmi tersedia, gunakan menu `Custom domain` di GitHub Pages.

Setelah domain aktif:

- Pastikan HTTPS aktif.
- Update metadata share di `index.html`, terutama `og:url`.
- Uji preview link di WhatsApp.

## Analytics Ringan

File `analytics.js` sudah tersedia dan dimuat oleh halaman publik, tetapi nonaktif secara default. Analytics hanya aktif jika `window.DONASI_ANALYTICS` diisi dengan `enabled: true` dan `endpoint`.

Contoh konfigurasi:

```html
<script>
  window.DONASI_ANALYTICS = {
    enabled: true,
    endpoint: 'https://example.com/analytics'
  };
</script>
<script src="analytics.js" defer></script>
```

Catatan:

- Jangan pasang analytics pada halaman admin.
- Gunakan analytics yang ringan dan tidak mengganggu privasi donatur.
- Hindari menyimpan data pribadi tanpa izin.

## Checklist Sebelum Membagikan Link

- Website bisa dibuka dari URL publik.
- QRIS bisa discan dari halaman publik.
- Tombol WhatsApp membuka pesan yang benar.
- Foto galeri tampil tanpa gambar pecah.
- Metadata share tampil benar di WhatsApp.
- Halaman admin tetap tidak muncul di mesin pencari.
- Domain resmi, jika ada, sudah memakai HTTPS.
