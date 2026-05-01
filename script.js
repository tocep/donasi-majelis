/* ===================================================
   Donasi Majelis Nuruzh Zholam — Public Script
   =================================================== */

let DATA = {
  majelis: {
    nama: 'Majelis Nuruzh Zholam',
    alamat: '',
    program: '',
    fotoMajelis: '',
  },
  donasi: {
    target: 0,
    danaTerpakai: 0,
    laporanTerakhir: '',
    catatanLaporan: '',
    qrisUrl: '',
    rekening: [],
    ewallet: [],
  },
  kontak: [],
  updatePembangunan: [],
  galeri: [],
  donatur: [],
};

let WHATSAPP_MESSAGE = 'Assalamualaikum, saya ingin berdonasi untuk pembangunan Majelis Nuruzh Zholam';
let dataLoadMessage = '';

const db = createSupabaseClient();

function formatRupiah(angka) {
  return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function formatTanggal(str) {
  if (!str) return 'Belum diperbarui';
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return 'Tanggal tidak valid';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function totalDonasiTercatat() {
  return DATA.donatur.reduce((total, item) => total + Number(item.nominal || 0), 0);
}

function createCopyButton(valueId, value) {
  const btn = document.createElement('button');
  btn.className = 'btn-copy';
  btn.type = 'button';
  btn.textContent = value ? 'Salin' : 'Belum diisi';
  btn.disabled = !value;
  if (value) {
    btn.addEventListener('click', () => copyText(valueId, btn));
  }
  return btn;
}

async function loadPublicData() {
  if (!db) {
    dataLoadMessage = 'Konfigurasi Supabase belum diisi. Data donasi belum dapat ditampilkan.';
    showDataNotice(dataLoadMessage);
    return;
  }

  try {
    const [
      settingsRes,
      paymentsRes,
      contactsRes,
      donorsRes,
      updatesRes,
      galleryRes,
    ] = await Promise.all([
      db.from('site_settings').select('*').eq('id', 1).single(),
      db.from('payment_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      db.from('contacts').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      db.from('donors').select('*').order('donation_date', { ascending: false }),
      db.from('building_updates').select('*').order('update_date', { ascending: false }),
      db.from('gallery_items').select('*').order('sort_order', { ascending: true }),
    ]);

    const responses = [settingsRes, paymentsRes, contactsRes, donorsRes, updatesRes, galleryRes];
    const failed = responses.find(res => res.error);
    if (failed) throw failed.error;

    const settings = settingsRes.data || {};
    const payments = paymentsRes.data || [];

    DATA = {
      majelis: {
        nama: settings.majelis_name || 'Majelis Nuruzh Zholam',
        alamat: settings.majelis_address || '',
        program: settings.majelis_program || '',
        fotoMajelis: settings.majelis_photo_url || '',
      },
      donasi: {
        target: Number(settings.donation_target || 0),
        danaTerpakai: Number(settings.funds_used || 0),
        laporanTerakhir: settings.report_date || '',
        catatanLaporan: settings.report_note || '',
        qrisUrl: settings.qris_url || '',
        rekening: payments.filter(item => item.method_type === 'bank').map(mapPaymentMethod),
        ewallet: payments.filter(item => item.method_type === 'ewallet').map(mapPaymentMethod),
      },
      kontak: (contactsRes.data || []).map(item => ({
        id: item.id,
        jabatan: item.role_name || '',
        nama: item.person_name || '',
        whatsapp: item.whatsapp || '',
      })),
      updatePembangunan: (updatesRes.data || []).map(item => ({
        id: item.id,
        tanggal: item.update_date,
        judul: item.title || '',
        deskripsi: item.description || '',
      })),
      galeri: (galleryRes.data || []).map(item => ({
        id: item.id,
        src: item.image_url || '',
        caption: item.caption || 'Foto kegiatan majelis',
      })),
      donatur: (donorsRes.data || []).map(item => ({
        id: item.id,
        nama: item.name || 'Hamba Allah',
        nominal: Number(item.amount || 0),
        tanggal: item.donation_date,
      })),
    };

    WHATSAPP_MESSAGE = settings.whatsapp_message || WHATSAPP_MESSAGE;
  } catch (error) {
    console.error('Gagal memuat data Supabase:', error);
    dataLoadMessage = 'Data donasi belum dapat dimuat. Silakan hubungi panitia untuk informasi terbaru.';
    showDataNotice(dataLoadMessage);
  }
}

function mapPaymentMethod(item) {
  return {
    id: item.id,
    kode: item.code || 'metode',
    label: item.label || item.name || 'Pay',
    nama: item.name || '',
    nomor: item.account_number || '',
    atasNama: item.account_name || '',
  };
}

function showDataNotice(message) {
  const noteEl = document.getElementById('progress-note');
  if (noteEl) noteEl.textContent = message;
}

const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navMenu.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', hamburger.classList.contains('open') ? 'true' : 'false');
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navMenu.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

function initProgress() {
  const terkumpul = totalDonasiTercatat();
  const target = Number(DATA.donasi.target || 0);
  const pct = target > 0 ? Math.min(Math.round((terkumpul / target) * 100), 100) : 0;
  const barEl = document.getElementById('progress-bar');
  const pctEl = document.getElementById('progress-pct');
  const terkEl = document.getElementById('stat-terkumpul');
  const donaturEl = document.getElementById('stat-donatur');
  const targetEl = document.getElementById('stat-target');
  const noteEl = document.getElementById('progress-note');

  terkEl.textContent = formatRupiah(terkumpul);
  donaturEl.textContent = DATA.donatur.length;
  targetEl.textContent = formatRupiah(target);
  barEl.style.width = '0%';
  pctEl.textContent = '0%';

  if (dataLoadMessage) {
    noteEl.textContent = dataLoadMessage;
  } else if (target <= 0) {
    noteEl.textContent = 'Target donasi belum diisi oleh panitia.';
  } else if (pct >= 100) {
    noteEl.textContent = 'Alhamdulillah! Target donasi telah tercapai. Terima kasih atas kepercayaan Anda!';
  } else {
    noteEl.textContent = `Kekurangan ${formatRupiah(target - terkumpul)} lagi. Bantu kami mencapai target.`;
  }

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

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(tc => {
        tc.classList.remove('active');
        tc.setAttribute('hidden', '');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab-' + target);
      panel.classList.add('active');
      panel.removeAttribute('hidden');
    });
  });
}

function initMetodeDonasi() {
  renderRekening();
  renderEwallet();
  renderQris();
}

function initTransparansi() {
  const terkumpul = totalDonasiTercatat();
  const target = Number(DATA.donasi.target || 0);
  const terpakai = Number(DATA.donasi.danaTerpakai || 0);
  const sisaTarget = Math.max(target - terkumpul, 0);
  const saldo = Math.max(terkumpul - terpakai, 0);

  const items = [
    { label: 'Dana Masuk Tercatat', value: formatRupiah(terkumpul), tone: 'primary' },
    { label: 'Dana Terpakai', value: formatRupiah(terpakai), tone: 'neutral' },
    { label: 'Saldo Tercatat', value: formatRupiah(saldo), tone: 'success' },
    { label: 'Sisa Target', value: formatRupiah(sisaTarget), tone: 'warning' },
  ];

  const grid = document.getElementById('fund-grid');
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = `fund-card fund-${item.tone}`;
    card.innerHTML = `
      <span>${escHtml(item.label)}</span>
      <strong>${escHtml(item.value)}</strong>
    `;
    grid.appendChild(card);
  });

  document.getElementById('laporan-update').textContent =
    DATA.donasi.laporanTerakhir ? `Update ${formatTanggal(DATA.donasi.laporanTerakhir)}` : 'Belum diperbarui';
  document.getElementById('laporan-catatan').textContent =
    DATA.donasi.catatanLaporan || 'Laporan dana akan diperbarui oleh panitia.';

  renderUpdatePembangunan();
}

function renderUpdatePembangunan() {
  const list = document.getElementById('update-list');
  list.innerHTML = '';

  if (DATA.updatePembangunan.length === 0) {
    list.innerHTML = '<p class="update-empty">Belum ada update pembangunan.</p>';
    return;
  }

  const sorted = [...DATA.updatePembangunan].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  sorted.forEach(item => {
    const row = document.createElement('article');
    row.className = 'update-item';
    row.innerHTML = `
      <time datetime="${escAttr(item.tanggal)}">${formatTanggal(item.tanggal)}</time>
      <h4>${escHtml(item.judul)}</h4>
      <p>${escHtml(item.deskripsi)}</p>
    `;
    list.appendChild(row);
  });
}

function renderRekening() {
  const list = document.getElementById('bank-list');
  list.innerHTML = '';

  if (DATA.donasi.rekening.length === 0) {
    list.innerHTML = '<p class="donatur-empty">Rekening resmi belum diisi oleh panitia.</p>';
    return;
  }

  DATA.donasi.rekening.forEach((item, index) => {
    const valueId = `rekening-${item.kode}-${index}`;
    const row = document.createElement('div');
    row.className = 'bank-item';
    row.innerHTML = `
      <div class="bank-logo bank-${escAttr(item.kode)}">${escHtml(item.label)}</div>
      <div class="bank-info">
        <span class="bank-name">${escHtml(item.nama)}</span>
        <span class="bank-number ${item.nomor ? '' : 'text-muted'}" id="${valueId}">${escHtml(item.nomor || 'Nomor rekening belum diisi')}</span>
        <span class="bank-atas-nama">a.n. ${escHtml(item.atasNama || 'Belum diisi')}</span>
      </div>
    `;
    row.appendChild(createCopyButton(valueId, item.nomor));
    list.appendChild(row);
  });
}

function renderEwallet() {
  const list = document.getElementById('ewallet-list');
  list.innerHTML = '';

  if (DATA.donasi.ewallet.length === 0) {
    list.innerHTML = '<p class="donatur-empty">E-wallet resmi belum diisi oleh panitia.</p>';
    return;
  }

  DATA.donasi.ewallet.forEach((item, index) => {
    const valueId = `ewallet-${item.kode}-${index}`;
    const row = document.createElement('div');
    row.className = 'ewallet-item';
    row.innerHTML = `
      <div class="ewallet-logo ${escAttr(item.kode)}">${escHtml(item.label)}</div>
      <div class="ewallet-info">
        <span class="ewallet-name">${escHtml(item.nama)}</span>
        <span class="ewallet-number ${item.nomor ? '' : 'text-muted'}" id="${valueId}">${escHtml(item.nomor || 'Nomor e-wallet belum diisi')}</span>
        <span class="ewallet-atas-nama">a.n. ${escHtml(item.atasNama || 'Belum diisi')}</span>
      </div>
    `;
    row.appendChild(createCopyButton(valueId, item.nomor));
    list.appendChild(row);
  });
}

function renderQris() {
  const qrisImg = document.getElementById('qris-img');
  if (!qrisImg) return;
  if (DATA.donasi.qrisUrl) {
    qrisImg.src = DATA.donasi.qrisUrl;
    qrisImg.alt = `QRIS Donasi ${DATA.majelis.nama}`;
    return;
  }
  qrisImg.removeAttribute('src');
  qrisImg.parentElement.innerHTML = '<div class="qris-placeholder">QRIS belum diisi panitia</div>';
}

function copyText(elId, btn) {
  const text = document.getElementById(elId).textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Tersalin!';
    btn.classList.add('copied');
    showToast('Nomor berhasil disalin');
    setTimeout(() => {
      btn.textContent = 'Salin';
      btn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
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
    showToast('Nomor berhasil disalin');
    setTimeout(() => {
      btn.textContent = 'Salin';
      btn.classList.remove('copied');
    }, 2000);
  });
}

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

function initTentang() {
  document.getElementById('majelis-alamat').textContent = DATA.majelis.alamat || 'Alamat majelis belum diisi.';
  document.getElementById('majelis-program').textContent = DATA.majelis.program || 'Program majelis belum diisi.';

  const photoWrap = document.getElementById('majelis-photo-wrap');
  if (photoWrap && DATA.majelis.fotoMajelis) {
    photoWrap.innerHTML = `<img src="${escAttrUrl(DATA.majelis.fotoMajelis)}" alt="Foto ${escHtml(DATA.majelis.nama)}" class="tentang-img" />`;
  }
}

function initKontak() {
  const grid = document.getElementById('kontak-grid');
  grid.innerHTML = '';

  if (DATA.kontak.length === 0) {
    grid.innerHTML = '<p class="donatur-empty">Kontak panitia belum diisi.</p>';
    return;
  }

  DATA.kontak.forEach(item => {
    const card = document.createElement('div');
    card.className = 'kontak-card';

    const phone = item.whatsapp.trim();
    const href = phone
      ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`
      : '';

    card.innerHTML = `
      <div class="kontak-icon">☎</div>
      <h3>${escHtml(item.jabatan)}</h3>
      <p>${escHtml(item.nama)}</p>
      ${
        href
          ? `<a href="${href}" class="btn btn-whatsapp" target="_blank" rel="noopener">Chat WhatsApp</a>`
          : '<span class="btn btn-whatsapp btn-disabled" aria-disabled="true">WhatsApp belum diisi</span>'
      }
    `;
    grid.appendChild(card);
  });
}

let lightboxIndex = 0;
let lightboxImages = [];

function initGaleri() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  lightboxImages = [];

  if (DATA.galeri.length === 0) {
    grid.innerHTML = '<p class="donatur-empty">Galeri foto belum diisi.</p>';
    return;
  }

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
      ph.innerHTML = `<span>Foto</span><p>${escHtml(item.caption)}</p><small>Gambar belum tersedia</small>`;
      div.appendChild(ph);
      div.style.cursor = 'default';
      div.removeAttribute('role');
    };

    img.src = item.src;
    div.appendChild(img);
    div.appendChild(cap);

    div.addEventListener('click', () => {
      const lbIdx = parseInt(div.dataset.lbIndex, 10);
      if (!Number.isNaN(lbIdx)) openLightbox(lbIdx);
    });
    div.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const lbIdx = parseInt(div.dataset.lbIndex, 10);
        if (!Number.isNaN(lbIdx)) openLightbox(lbIdx);
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
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
});

function initDonatur() {
  const grid = document.getElementById('donatur-grid');
  grid.innerHTML = '';

  if (DATA.donatur.length === 0) {
    grid.innerHTML = '<p class="donatur-empty">Daftar donatur akan tampil setelah panitia mencatat donasi masuk.</p>';
    return;
  }

  const sorted = [...DATA.donatur].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  sorted.forEach(d => {
    const initial = (d.nama || 'H').trim().charAt(0).toUpperCase();
    const card = document.createElement('div');
    card.className = 'donatur-card';
    card.innerHTML = `
      <div class="donatur-avatar">${escHtml(initial)}</div>
      <div class="donatur-info">
        <div class="donatur-name">${escHtml(d.nama)}</div>
        <div class="donatur-date">${formatTanggal(d.tanggal)}</div>
      </div>
      <div class="donatur-amount">${formatRupiah(d.nominal)}</div>
    `;
    grid.appendChild(card);
  });
}

function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active-link', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-50% 0px -45% 0px' });

  sections.forEach(s => observer.observe(s));
}

function renderPublicPage() {
  initTentang();
  initMetodeDonasi();
  initProgress();
  initTransparansi();
  initTabs();
  initGaleri();
  initDonatur();
  initKontak();
  initActiveNav();
}

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/[^a-z0-9_-]/gi, '');
}

function escAttrUrl(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPublicData();
  renderPublicPage();
});
