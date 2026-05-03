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
  rincianDana: [],
  kontak: [],
  updatePembangunan: [],
  galeri: [],
  donatur: [],
};

let WHATSAPP_MESSAGE = 'Assalamualaikum, saya ingin berdonasi untuk pembangunan Majelis Nuruzh Zholam';
let dataLoadMessage = '';
let realtimeChannel = null;

const db = createSupabaseClient();

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
      breakdownRes,
    ] = await Promise.all([
      db.from('site_settings').select('*').eq('id', 1).single(),
      db.from('payment_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      db.from('contacts').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      db.from('donors').select('*').order('donation_date', { ascending: false }),
      db.from('building_updates').select('*').order('update_date', { ascending: false }),
      db.from('gallery_items').select('*').order('sort_order', { ascending: true }),
      db.from('fund_breakdown').select('*').order('sort_order', { ascending: true }),
    ]);

    const responses = [settingsRes, paymentsRes, contactsRes, donorsRes, updatesRes, galleryRes, breakdownRes];
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
      rincianDana: (breakdownRes.data || []).map(item => ({
        id: item.id,
        label: item.label || '',
        amount: Number(item.amount || 0),
        sortOrder: Number(item.sort_order || 0),
      })),
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
        isAnonim: Boolean(item.is_anonymous),
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
    terverifikasiPada: item.verified_at || '',
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

  renderFundBreakdown();
  renderUpdatePembangunan();
}

function renderFundBreakdown() {
  const wrap = document.getElementById('fund-breakdown');
  if (!wrap) return;

  if (DATA.rincianDana.length === 0) {
    wrap.innerHTML = '<p class="transparency-note">Rincian kebutuhan dana akan ditambahkan panitia.</p>';
    return;
  }

  const total = DATA.rincianDana.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  wrap.innerHTML = `
    <div class="fund-breakdown-head">
      <h4>Rincian Kebutuhan Dana</h4>
      <span>Total RAB ${formatRupiah(total)}</span>
    </div>
    <div class="fund-breakdown-list">
      ${DATA.rincianDana.map(item => `
        <div class="fund-breakdown-row">
          <span>${escHtml(item.label)}</span>
          <strong>${formatRupiah(item.amount)}</strong>
        </div>
      `).join('')}
    </div>
  `;
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
      <div class="bank-logo bank-${escSafeClass(item.kode)}">${escHtml(item.label)}</div>
      <div class="bank-info">
        <span class="bank-name">${escHtml(item.nama)}</span>
        <span class="bank-number ${item.nomor ? '' : 'text-muted'}" id="${valueId}">${escHtml(item.nomor || 'Nomor rekening belum diisi')}</span>
        <span class="bank-atas-nama">a.n. ${escHtml(item.atasNama || 'Belum diisi')}</span>
        ${item.terverifikasiPada ? `<span class="bank-verified">Diverifikasi panitia per ${formatTanggal(item.terverifikasiPada)}</span>` : ''}
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
      <div class="ewallet-logo ${escSafeClass(item.kode)}">${escHtml(item.label)}</div>
      <div class="ewallet-info">
        <span class="ewallet-name">${escHtml(item.nama)}</span>
        <span class="ewallet-number ${item.nomor ? '' : 'text-muted'}" id="${valueId}">${escHtml(item.nomor || 'Nomor e-wallet belum diisi')}</span>
        <span class="ewallet-atas-nama">a.n. ${escHtml(item.atasNama || 'Belum diisi')}</span>
        ${item.terverifikasiPada ? `<span class="bank-verified">Diverifikasi panitia per ${formatTanggal(item.terverifikasiPada)}</span>` : ''}
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

    img.src = galleryImageUrl(item.src);
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
    const nama = d.isAnonim ? 'Hamba Allah' : (d.nama || 'Hamba Allah');
    const initial = (nama || 'H').trim().charAt(0).toUpperCase();
    const card = document.createElement('div');
    card.className = 'donatur-card';
    card.innerHTML = `
      <div class="donatur-avatar">${escHtml(initial)}</div>
      <div class="donatur-info">
        <div class="donatur-name">${escHtml(nama)}</div>
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
  initWhatsAppShare();
  initConfirmationForm();
  initActiveNav();
}

function initConfirmationForm() {
  const form = document.getElementById('confirmation-form');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';
  const dateInput = document.getElementById('confirmation-date');
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
  form.addEventListener('submit', handleConfirmationSubmit);
}

async function handleConfirmationSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('confirmation-status');
  const submitBtn = event.submitter || form.querySelector('button[type="submit"]');

  if (!db) {
    status.textContent = 'Konfirmasi belum bisa dikirim karena Supabase belum dikonfigurasi.';
    return;
  }

  const file = document.getElementById('confirmation-proof').files[0];
  const payload = {
    name: document.getElementById('confirmation-name').value.trim(),
    amount: Number(document.getElementById('confirmation-amount').value),
    donation_date: document.getElementById('confirmation-date').value,
    whatsapp: document.getElementById('confirmation-whatsapp').value.trim(),
    notes: document.getElementById('confirmation-notes').value.trim(),
    proof_url: '',
    status: 'pending',
  };

  if (!payload.name || payload.amount <= 0 || !payload.donation_date || !/^628[0-9]{8,15}$/.test(payload.whatsapp)) {
    status.textContent = 'Nama, nominal, tanggal, dan WhatsApp format 628... wajib valid.';
    return;
  }
  if (!file) {
    status.textContent = 'Bukti transfer wajib diunggah.';
    return;
  }

  try {
    submitBtn.disabled = true;
    status.textContent = 'Mengunggah bukti transfer...';
    payload.proof_url = await uploadPublicProof(file);
    status.textContent = 'Mengirim konfirmasi...';
    const { error } = await db.from('pending_confirmations').insert(payload);
    if (error) throw error;
    form.reset();
    document.getElementById('confirmation-date').value = new Date().toISOString().slice(0, 10);
    status.textContent = 'Konfirmasi terkirim. Panitia akan memverifikasi donasi Anda.';
    showToast('Konfirmasi donasi terkirim.');
  } catch (error) {
    status.textContent = error.message || 'Konfirmasi gagal dikirim. Coba lagi atau hubungi panitia.';
  } finally {
    submitBtn.disabled = false;
  }
}

async function uploadPublicProof(file) {
  if (!file.type.startsWith('image/')) throw new Error('Bukti transfer harus berupa gambar.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Ukuran bukti transfer maksimal 3 MB.');
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const path = `confirmations/${Date.now()}-${safeName}`;
  const { error } = await db.storage.from(SUPABASE_CONFIG.storageBucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data } = db.storage.from(SUPABASE_CONFIG.storageBucket).getPublicUrl(path);
  return data.publicUrl;
}

function galleryImageUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('width')) parsed.searchParams.set('width', '800');
    if (!parsed.searchParams.has('quality')) parsed.searchParams.set('quality', '80');
    return parsed.toString();
  } catch {
    return url;
  }
}

function initWhatsAppShare() {
  const share = document.getElementById('share-whatsapp');
  if (!share) return;
  const terkumpul = totalDonasiTercatat();
  const target = Number(DATA.donasi.target || 0);
  const url = window.location.href.split('#')[0];
  const text = `Bantu pembangunan ${DATA.majelis.nama}. Sudah terkumpul ${formatRupiah(terkumpul)} dari target ${formatRupiah(target)}. Yuk berdonasi: ${url}`;
  share.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function initRealtimeUpdates() {
  if (!db || realtimeChannel) return;
  realtimeChannel = db.channel('donors-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'donors',
    }, () => {
      loadPublicData().then(renderPublicPage);
    })
    .subscribe();
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadPublicData();
  renderPublicPage();
  initRealtimeUpdates();
});
