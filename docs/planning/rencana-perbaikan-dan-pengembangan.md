# Rencana Perbaikan dan Pengembangan Website Donasi

Dokumen ini menjadi acuan kerja untuk memperbaiki dan mengembangkan website donasi Majelis Nuruzh Zholam. Fokus utama proyek adalah membangun halaman donasi yang ringan, jelas, mudah diperbarui, dan dapat dipercaya oleh calon donatur.

## 1. Ringkasan Proyek

Website saat ini berupa halaman statis berbasis HTML, CSS, dan JavaScript murni.

Status eksekusi terakhir: 1 Mei 2026.

Perubahan yang sudah dijalankan:

- Progress donasi sekarang dihitung otomatis dari `DATA.donatur`.
- Target donasi ditampilkan dari `DATA.donasi.target`.
- Data rekening, e-wallet, kontak, alamat, dan program majelis mulai dipusatkan di `script.js`.
- Nomor rekening, e-wallet, dan WhatsApp contoh dihapus dari tampilan agar tidak terlihat seperti data resmi.
- Tombol salin dan WhatsApp otomatis nonaktif jika data resmi belum diisi.
- Atribut aksesibilitas dasar untuk hamburger dan tab diperbaiki.
- Panduan operasional update konten ditambahkan di `docs/planning/panduan-update-konten.md`.
- Section Transparansi Dana ditambahkan untuk menampilkan dana masuk, dana terpakai, saldo, sisa target, dan update pembangunan.
- Metadata dasar Open Graph dan theme color ditambahkan untuk persiapan preview link.

File utama:

- `index.html`: struktur halaman, konten utama, metode donasi, kontak, dan footer.
- `style.css`: tampilan responsive, layout, warna, kartu, galeri, lightbox, dan komponen UI.
- `script.js`: data donasi, daftar donatur, progress bar, tab donasi, galeri, lightbox, toast, dan navigasi aktif.
- `images/BACA-INI.txt`: panduan penamaan file QRIS dan foto galeri.

Fitur yang sudah tersedia:

- Hero section dengan ajakan donasi.
- Progress donasi.
- Pilihan metode donasi: transfer bank, QRIS, dan e-wallet.
- Tombol salin nomor rekening/ewallet.
- Galeri foto dengan fallback placeholder.
- Lightbox galeri.
- Daftar donatur.
- Bagian tentang pembangunan.
- Kontak WhatsApp panitia.
- Tampilan responsive untuk mobile dan desktop.

## 2. Kondisi Saat Ini

Beberapa bagian masih berupa data contoh dan perlu diganti sebelum website dipublikasikan:

- Nomor rekening bank.
- Nomor e-wallet.
- Nomor WhatsApp panitia.
- Nama ketua panitia dan sekretaris.
- Alamat majelis.
- QRIS asli.
- Foto galeri asli.
- Foto majelis pada bagian tentang.
- Data donatur aktual.

Catatan teknis penting:

- Nilai `terkumpul` di `script.js` saat ini belum otomatis dihitung dari daftar donatur.
- Total nominal pada daftar donatur tidak sama dengan nilai progress donasi.
- Data rekening dan kontak masih ditulis langsung di `index.html`, sedangkan data donatur dan galeri ada di `script.js`.
- Belum ada dokumen operasional untuk cara update konten.
- Belum ada metadata lengkap untuk preview saat link dibagikan di WhatsApp atau media sosial.

## 3. Tujuan Pengembangan

Tujuan utama:

- Meningkatkan kepercayaan calon donatur.
- Mempermudah panitia memperbarui data donasi.
- Mengurangi risiko salah data pada nominal, rekening, kontak, dan daftar donatur.
- Menjadikan website lebih siap dipublikasikan dan dibagikan.
- Menjaga website tetap ringan dan mudah di-hosting.

Prinsip pengembangan:

- Tetap sederhana selama kebutuhan masih bisa dipenuhi dengan website statis.
- Data penting harus mudah ditemukan dan diperbarui.
- Informasi donasi harus akurat, transparan, dan mudah diverifikasi.
- Tampilan mobile harus menjadi prioritas karena mayoritas calon donatur kemungkinan membuka dari WhatsApp.

## 4. Prioritas Perbaikan

### P0 - Wajib Sebelum Publikasi

Item berikut harus selesai sebelum website dibagikan ke publik.

1. Ganti seluruh data placeholder.
   - Nomor rekening bank.
   - Nomor e-wallet.
   - Nama pemilik rekening.
   - Nomor WhatsApp panitia.
   - Nama panitia.
   - Alamat majelis.

2. Tambahkan aset asli.
   - `images/qris.png`
   - `images/gallery-1.jpg` sampai `images/gallery-6.jpg`
   - Foto utama majelis untuk bagian tentang.

3. Samakan angka progress donasi.
   - Pilih salah satu pendekatan:
     - `terkumpul` dihitung otomatis dari daftar donatur.
     - `terkumpul` tetap manual, tetapi diberi label sebagai total aktual.
   - Rekomendasi: hitung otomatis dari daftar donatur jika semua donasi memang dipublikasikan.

4. Verifikasi semua link WhatsApp.
   - Pastikan format nomor menggunakan kode negara Indonesia, contoh `62812...`.
   - Pastikan pesan awal WhatsApp sopan dan jelas.

5. Uji di perangkat mobile.
   - Navbar.
   - Tab metode donasi.
   - Tombol salin.
   - QRIS.
   - Galeri dan lightbox.
   - Link WhatsApp.

### P1 - Penting Untuk Kepercayaan

1. Tambahkan bagian transparansi dana.
   - Target total biaya.
   - Rincian kebutuhan utama.
   - Dana masuk.
   - Dana terpakai.
   - Sisa kebutuhan.

2. Tambahkan update pembangunan.
   - Tanggal update.
   - Deskripsi progres.
   - Foto pendukung.

3. Tambahkan informasi legal/panitia.
   - Nama penanggung jawab.
   - Susunan panitia ringkas.
   - Kontak resmi.
   - Lokasi majelis.

4. Tambahkan metadata untuk share link.
   - Favicon.
   - Open Graph title.
   - Open Graph description.
   - Open Graph image.
   - Preview khusus untuk WhatsApp/Facebook.

5. Buat panduan update konten.
   - Cara mengubah data donatur.
   - Cara mengubah rekening.
   - Cara mengganti QRIS.
   - Cara mengganti foto.
   - Cara publish ulang.

### P2 - Peningkatan Teknis dan UX

1. Pusatkan konfigurasi data.
   - Pindahkan data rekening, e-wallet, kontak, dan informasi majelis ke satu konfigurasi di JavaScript.
   - Render bagian terkait secara otomatis.

2. Tingkatkan aksesibilitas.
   - Tambahkan `aria-expanded` pada tombol hamburger.
   - Tambahkan relasi `aria-controls` pada tab.
   - Gunakan `role="tabpanel"` pada konten tab.
   - Tambahkan focus trap sederhana pada lightbox.
   - Pastikan semua tombol bisa digunakan dengan keyboard.

3. Tambahkan validasi data internal.
   - Cek jika target donasi bernilai nol.
   - Cek format tanggal donatur.
   - Cek nominal donatur harus angka positif.
   - Cek nomor kontak tidak kosong.

4. Optimasi performa.
   - Kompres semua gambar.
   - Gunakan format `.webp` untuk foto besar jika memungkinkan.
   - Tambahkan dimensi gambar agar layout lebih stabil.
   - Pertimbangkan preload hanya untuk aset penting.

5. Tambahkan halaman atau section FAQ.
   - Apakah donasi bisa anonim?
   - Bagaimana konfirmasi setelah transfer?
   - Kapan data donatur diperbarui?
   - Apakah laporan dana tersedia?

### P3 - Pengembangan Lanjutan

1. Integrasi data eksternal.
   - Google Sheets sebagai sumber data donatur.
   - JSON file terpisah untuk data konten.
   - Admin panel sederhana jika diperlukan.

2. Laporan donasi berkala.
   - Export laporan ke PDF.
   - Rekap bulanan.
   - Riwayat penggunaan dana.

3. Deployment otomatis.
   - Hosting di GitHub Pages, Netlify, atau Vercel.
   - Setup repository Git.
   - Workflow publish sederhana.

4. Analytics ringan.
   - Hitung jumlah pengunjung.
   - Lacak klik tombol WhatsApp.
   - Lacak klik tombol salin rekening.
   - Gunakan analytics yang menghormati privasi.

## 5. Rekomendasi Struktur Data

Untuk mengurangi duplikasi, data website sebaiknya dipusatkan. Contoh struktur:

```js
const DATA = {
  majelis: {
    nama: 'Majelis Nuruzh Zholam',
    alamat: 'Alamat lengkap majelis',
    program: 'Pengajian rutin setiap Minggu & Kamis malam'
  },
  donasi: {
    target: 50000000,
    rekening: [
      {
        bank: 'BCA',
        nomor: '1234567890',
        atasNama: 'Panitia Pembangunan Majelis'
      }
    ],
    ewallet: [
      {
        nama: 'DANA',
        nomor: '08123456789',
        atasNama: 'Nama Panitia'
      }
    ]
  },
  kontak: [
    {
      jabatan: 'Panitia Pembangunan',
      nama: 'Nama Ketua Panitia',
      whatsapp: '6281234567890'
    }
  ],
  galeri: [],
  donatur: []
};
```

Dengan struktur seperti ini, pembaruan data cukup dilakukan di satu tempat.

## 6. Rekomendasi Konten Kepercayaan

Konten yang disarankan untuk ditambahkan:

- Foto kondisi bangunan saat ini.
- Foto kegiatan pengajian.
- Foto panitia atau pengurus.
- Rencana desain atau gambar renovasi/pembangunan.
- Rincian kebutuhan dana.
- Laporan dana masuk dan dana keluar.
- Tanggal terakhir update data.
- Kalimat penegasan bahwa rekening dan QRIS adalah rekening resmi panitia.

Contoh blok transparansi:

```text
Target pembangunan: Rp 50.000.000
Dana terkumpul: Rp 12.500.000
Dana terpakai: Rp 3.000.000
Sisa kebutuhan: Rp 40.500.000
Terakhir diperbarui: 1 Mei 2026
```

## 7. Checklist Konten Sebelum Rilis

- [ ] Nama majelis sudah benar.
- [ ] Penulisan "Nuruzh Zholam" sudah sesuai dengan nama resmi.
- [ ] Alamat sudah lengkap.
- [ ] Nomor rekening sudah benar.
- [ ] Nama pemilik rekening sudah benar.
- [ ] Nomor WhatsApp sudah benar.
- [ ] QRIS sudah bisa discan.
- [ ] Foto galeri sudah tampil.
- [ ] Data donatur sudah valid.
- [ ] Total donasi sudah sesuai.
- [ ] Link WhatsApp sudah terbuka dengan pesan yang benar.
- [ ] Tidak ada data dummy seperti `1234567890`, `08123456789`, atau `Nama Panitia`.

## 8. Checklist Teknis Sebelum Rilis

- [ ] Website dibuka di Chrome mobile.
- [ ] Website dibuka di Safari mobile jika memungkinkan.
- [ ] Navbar mobile bisa dibuka dan ditutup.
- [ ] Semua menu mengarah ke section yang benar.
- [ ] Progress bar tampil benar.
- [ ] Tombol salin bekerja.
- [ ] Tab Bank, QRIS, dan E-Wallet bekerja.
- [ ] Galeri tampil tanpa gambar pecah.
- [ ] Lightbox bisa dibuka dan ditutup.
- [ ] Link WhatsApp membuka aplikasi/web WhatsApp.
- [ ] Ukuran gambar sudah dikompres.
- [ ] Tidak ada error JavaScript di console browser.

## 9. Rekomendasi Tahapan Eksekusi

### Tahap 1 - Siap Publikasi

Estimasi: 1 hari kerja.

- Ganti data placeholder.
- Tambahkan QRIS dan foto asli.
- Samakan angka donasi.
- Tes manual di mobile dan desktop.

Output:

- Website siap dibagikan ke calon donatur.

### Tahap 2 - Transparansi dan Kredibilitas

Estimasi: 1 sampai 2 hari kerja.

- Tambahkan section transparansi dana.
- Tambahkan update pembangunan.
- Tambahkan metadata share.
- Tambahkan panduan update konten.

Output:

- Website lebih dipercaya dan lebih informatif.

### Tahap 3 - Kemudahan Operasional

Estimasi: 2 sampai 4 hari kerja.

- Pusatkan data konfigurasi.
- Pertimbangkan data eksternal dari Google Sheets atau JSON.
- Buat proses update yang bisa dilakukan panitia non-teknis.

Output:

- Website lebih mudah dirawat.

### Tahap 4 - Publikasi Profesional

Estimasi: 1 sampai 2 hari kerja.

- Setup Git repository.
- Pilih hosting.
- Tambahkan domain jika tersedia.
- Tambahkan analytics ringan.

Output:

- Website memiliki alamat publik yang stabil dan mudah dibagikan.

## 10. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Nomor rekening salah | Donasi masuk ke tujuan yang salah | Verifikasi ganda oleh panitia sebelum rilis |
| QRIS tidak valid | Donatur gagal membayar | Uji scan dari beberapa aplikasi pembayaran |
| Data donatur tidak sinkron | Kepercayaan turun | Gunakan satu sumber data dan tanggal update |
| Foto terlalu besar | Website lambat di HP | Kompres gambar maksimal sekitar 500 KB per foto |
| Update manual rawan salah | Data publik keliru | Buat panduan update dan checklist |
| Tidak ada laporan penggunaan dana | Donatur ragu | Tambahkan section transparansi dan update rutin |

## 11. Kriteria Selesai

Website dianggap siap dipublikasikan jika:

- Semua data dummy telah diganti.
- QRIS dan semua nomor rekening telah diverifikasi.
- Total donasi dan daftar donatur konsisten.
- Website nyaman dibuka di layar HP.
- Link WhatsApp berfungsi.
- Tidak ada error JavaScript.
- Ada informasi kontak resmi panitia.
- Ada minimal satu bentuk transparansi penggunaan dana.

## 12. Catatan Pengembangan

Untuk tahap awal, proyek tidak perlu langsung memakai framework seperti React atau Next.js. Struktur HTML/CSS/JS saat ini sudah cukup untuk kebutuhan landing page donasi. Framework baru layak dipertimbangkan jika:

- Konten sering diperbarui oleh banyak orang.
- Dibutuhkan dashboard admin.
- Dibutuhkan login panitia.
- Dibutuhkan integrasi database.
- Dibutuhkan laporan otomatis.

Selama kebutuhan masih sederhana, menjaga proyek tetap statis akan membuatnya lebih murah, cepat, dan mudah di-hosting.
