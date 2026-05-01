# Publikasi Profesional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyiapkan website donasi untuk publikasi profesional melalui Git repository lokal, GitHub Pages, dokumentasi publikasi, dan analytics ringan nonaktif.

**Architecture:** Website tetap statis dan disajikan langsung dari root repository. Konfigurasi publikasi ditempatkan di file kecil yang tidak mengubah alur utama website. Analytics dibuat defensive dan nonaktif sampai panitia memilih endpoint.

**Tech Stack:** HTML, CSS, JavaScript statis, Git, GitHub Pages.

---

### Task 1: Repository dan File Publikasi

**Files:**
- Create: `.gitignore`
- Create: `.nojekyll`
- Create: `README.md`
- Create: `docs/planning/publikasi-profesional.md`

- [x] **Step 1: Tambahkan `.gitignore`**

Tambahkan file untuk mengabaikan file sistem, environment lokal, dependency, dan folder editor.

- [x] **Step 2: Tambahkan `.nojekyll`**

Tambahkan file kosong agar GitHub Pages tidak memproses website sebagai Jekyll site.

- [x] **Step 3: Tambahkan `README.md`**

Dokumentasikan struktur proyek, cara menjalankan lokal, GitHub Pages, domain, dan analytics.

- [x] **Step 4: Tambahkan panduan publikasi**

Simpan langkah operasional di `docs/planning/publikasi-profesional.md`.

### Task 2: Analytics Ringan

**Files:**
- Create: `analytics.js`
- Modify: `index.html`

- [x] **Step 1: Tambahkan `analytics.js`**

Tambahkan script yang keluar lebih awal saat konfigurasi belum aktif.

- [x] **Step 2: Muat `analytics.js` di halaman publik**

Tambahkan script dengan `defer` pada `index.html`.

### Task 3: Git dan Verifikasi

**Files:**
- Modify: `.git/`

- [x] **Step 1: Inisialisasi Git repository**

Run: `git init`

- [x] **Step 2: Verifikasi status Git**

Run: `git status --short --branch`

- [x] **Step 3: Verifikasi HTML lokal**

Run: `python3 -m http.server 4173`

Buka `http://127.0.0.1:4173/index.html` atau uji dengan browser headless jika tersedia.
