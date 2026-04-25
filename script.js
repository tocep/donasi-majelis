/* ===================================================
   Donasi Majelis Nuruzh Zholam — Script
   =================================================== */

/* --------------------------------------------------
   DATA — Edit bagian ini untuk update konten website
   -------------------------------------------------- */

const DATA = {
  // Progress donasi
  terkumpul: 12500000,   // Jumlah yang sudah terkumpul (dalam rupiah)
  target:    50000000,   // Target donasi

  // Galeri foto — ganti src dengan path foto asli di folder images/
  // Jika src tidak tersedia, akan tampil placeholder otomatis
  galeri: [
    { src: 'images/gallery-1.jpg', caption: 'Kondisi majelis saat ini' },
    { src: 'images/gallery-2.jpg', caption: 'Tampak depan majelis' },
    { src: 'images/gallery-3.jpg', caption: 'Ruang utama pengajian' },
    { src: 'images/gallery-4.jpg', caption: 'Rencana pembangunan' },
    { src: 'images/gallery-5.jpg', caption: 'Kegiatan pengajian rutin' },
    { src: 'images/gallery-6.jpg', caption: 'Jamaah Majelis Nuruzh Zholam' },
  ],

  // Daftar donatur — tambahkan nama donatur yang sudah transfer
  donatur: [
    { nama: 'Hamba Allah',       nominal: 500000,   tanggal: '2026-04-01' },
    { nama: 'Ahmad Fauzi',       nominal: 1000000,  tanggal: '2026-04-05' },
    { nama: 'Siti Rahmawati',    nominal: 250000,   tanggal: '2026-04-08' },
    { nama: 'H. Budi Santoso',   nominal: 2000000,  tanggal: '2026-04-10' },
    { nama: 'Hamba Allah',       nominal: 100000,   tanggal: '2026-04-12' },
    { nama: 'Dewi Kurniasari',   nominal: 500000,   tanggal: '2026-04-15' },
    { nama: 'Muhamad Rizki',     nominal: 1500000,  tanggal: '2026-04-18' },
    { nama: 'Nur Hasanah',       nominal: 300000,   tanggal: '2026-04-20' },
    { nama: 'Keluarga Sutrisno', nominal: 5000000,  tanggal: '2026-04-22' },
    { nama: 'Anonim',            nominal: 150000,   tanggal: '2026-04-24' },
  ],
};

/* --------------------------------------------------
   FORMAT RUPIAH
   -------------------------------------------------- */
function formatRupiah(angka) {
  return 'Rp ' + angka.toLocaleString('id-ID');
}

function formatTanggal(str) {
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* --------------------------------------------------
   NAVBAR — sticky scroll & hamburger
   -------------------------------------------------- */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu   = document.getElementById('nav-menu');
const navLinks  = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMenu.classList.toggle('open');
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navMenu.classList.remove('open');
  });
});

/* --------------------------------------------------
   PROGRESS BAR — animasi saat masuk viewport
   -------------------------------------------------- */
function initProgress() {
  const pct      = Math.min(Math.round((DATA.terkumpul / DATA.target) * 100), 100);
  const barEl    = document.getElementById('progress-bar');
  const pctEl    = document.getElementById('progress-pct');
  const terkEl   = document.getElementById('stat-terkumpul');
  const donaturEl = document.getElementById('stat-donatur');
  const noteEl   = document.getElementById('progress-note');

  terkEl.textContent    = formatRupiah(DATA.terkumpul);
  donaturEl.textContent = DATA.donatur.length;

  if (pct >= 100) {
    noteEl.textContent = '🎉 Alhamdulillah! Target donasi telah tercapai. Terima kasih atas kepercayaan Anda!';
  } else {
    const sisa = DATA.target - DATA.terkumpul;
    noteEl.textContent = `Kekurangan ${formatRupiah(sisa)} lagi. Bantu kami mencapai target!`;
  }

  // Animate on scroll into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        barEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(barEl.parentElement);
}

/* --------------------------------------------------
   TABS — Cara Donasi
   -------------------------------------------------- */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById('tab-' + target).classList.add('active');
    });
  });
}

/* --------------------------------------------------
   COPY TO CLIPBOARD
   -------------------------------------------------- */
function copyText(elId, btn) {
  const text = document.getElementById(elId).textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Tersalin!';
    btn.classList.add('copied');
    showToast('Nomor berhasil disalin ✓');
    setTimeout(() => {
      btn.textContent = 'Salin';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    btn.textContent = 'Tersalin!';
    btn.classList.add('copied');
    showToast('Nomor berhasil disalin ✓');
    setTimeout(() => {
      btn.textContent = 'Salin';
      btn.classList.remove('copied');
    }, 2000);
  });
}

/* --------------------------------------------------
   TOAST NOTIFICATION
   -------------------------------------------------- */
let toastTimer;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  clearTimeout(toastTimer);
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/* --------------------------------------------------
   GALERI — render & lightbox
   -------------------------------------------------- */
let lightboxIndex = 0;
const lightboxImages = []; // Only images that loaded successfully

function initGaleri() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';

  DATA.galeri.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', item.caption);

    const img = document.createElement('img');
    img.alt = item.caption;
    img.loading = 'lazy';

    const cap = document.createElement('div');
    cap.className = 'gallery-caption-overlay';
    cap.textContent = item.caption;

    img.onload = () => {
      lightboxImages.push({ src: item.src, caption: item.caption, index: i });
      div.dataset.lbIndex = lightboxImages.length - 1;
    };

    img.onerror = () => {
      img.remove();
      cap.remove();
      const ph = document.createElement('div');
      ph.className = 'gallery-placeholder';
      ph.innerHTML = `<span>📷</span><p>${item.caption}</p><small>Tambahkan foto di images/</small>`;
      div.appendChild(ph);
      div.style.cursor = 'default';
      div.removeAttribute('role');
    };

    img.src = item.src;
    div.appendChild(img);
    div.appendChild(cap);

    div.addEventListener('click', () => {
      const lbIdx = parseInt(div.dataset.lbIndex);
      if (!isNaN(lbIdx)) openLightbox(lbIdx);
    });
    div.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const lbIdx = parseInt(div.dataset.lbIndex);
        if (!isNaN(lbIdx)) openLightbox(lbIdx);
      }
    });

    grid.appendChild(div);
  });
}

function openLightbox(idx) {
  if (lightboxImages.length === 0) return;
  lightboxIndex = idx;
  updateLightbox();
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('lightbox-close').focus();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

function updateLightbox() {
  const item = lightboxImages[lightboxIndex];
  document.getElementById('lightbox-img').src = item.src;
  document.getElementById('lightbox-img').alt = item.caption;
  document.getElementById('lightbox-caption').textContent = item.caption;
}

function lightboxNav(dir) {
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  updateLightbox();
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-prev').addEventListener('click', () => lightboxNav(-1));
document.getElementById('lightbox-next').addEventListener('click', () => lightboxNav(1));
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === document.getElementById('lightbox')) closeLightbox();
});
document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   lightboxNav(-1);
  if (e.key === 'ArrowRight')  lightboxNav(1);
});

/* --------------------------------------------------
   DONATUR — render cards
   -------------------------------------------------- */
function initDonatur() {
  const grid = document.getElementById('donatur-grid');
  grid.innerHTML = '';

  if (DATA.donatur.length === 0) {
    grid.innerHTML = '<p class="donatur-empty">Jadilah yang pertama berdonasi! ☺</p>';
    return;
  }

  // Sort by date descending (newest first)
  const sorted = [...DATA.donatur].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  sorted.forEach(d => {
    const initial = d.nama.trim().charAt(0).toUpperCase();
    const card = document.createElement('div');
    card.className = 'donatur-card';
    card.innerHTML = `
      <div class="donatur-avatar">${initial}</div>
      <div class="donatur-info">
        <div class="donatur-name">${escHtml(d.nama)}</div>
        <div class="donatur-date">${formatTanggal(d.tanggal)}</div>
      </div>
      <div class="donatur-amount">${formatRupiah(d.nominal)}</div>
    `;
    grid.appendChild(card);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* --------------------------------------------------
   SMOOTH ACTIVE NAV LINK on scroll (Intersection)
   -------------------------------------------------- */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active-link',
            link.getAttribute('href') === '#' + id
          );
        });
      }
    });
  }, { rootMargin: '-50% 0px -45% 0px' });

  sections.forEach(s => observer.observe(s));
}

/* --------------------------------------------------
   INIT
   -------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initProgress();
  initTabs();
  initGaleri();
  initDonatur();
  initActiveNav();
});
