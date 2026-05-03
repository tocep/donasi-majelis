/* ===================================================
   Donasi Majelis Nuruzh Zholam — Admin Script
   =================================================== */

const adminDb = createSupabaseClient();
const DONORS_PAGE_SIZE = 20;

const state = {
  adminUser: null,
  settings: null,
  donors: [],
  donorSearch: '',
  donorPage: 1,
  donorsTotal: 0,
  donorsTotalAmount: 0,
  confirmations: [],
  breakdown: [],
  payments: [],
  contacts: [],
  updates: [],
  updatesError: '',
  updatesLoaded: false,
  gallery: [],
  galleryError: '',
  galleryLoaded: false,
  modalType: '',
  editingId: null,
};

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginStatus = document.getElementById('login-status');
const modal = document.getElementById('admin-modal');
const modalForm = document.getElementById('modal-form');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');

document.addEventListener('DOMContentLoaded', initAdmin);

async function initAdmin() {
  if (!adminDb) {
    loginStatus.textContent = 'Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.';
    return;
  }

  bindAdminEvents();
  try {
    const { data } = await withTimeout(
      adminDb.auth.getSession(),
      12000,
      'Koneksi ke Supabase terlalu lama. Muat ulang halaman lalu coba lagi.'
    );
    if (data.session) {
      await showDashboard();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
    loginStatus.textContent = error.message || 'Gagal memeriksa sesi admin.';
  }
}

function bindAdminEvents() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('report-form').addEventListener('submit', handleReportSave);
  document.getElementById('profile-form').addEventListener('submit', handleProfileSave);
  document.getElementById('export-donors-csv').addEventListener('click', exportDonorsCsv);
  document.getElementById('import-donors-csv').addEventListener('change', importDonorsCsv);
  document.getElementById('donor-search').addEventListener('input', handleDonorSearch);
  document.getElementById('refresh-confirmations').addEventListener('click', retryConfirmationsLoad);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modalForm.addEventListener('submit', handleModalSave);

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.adminTab);
      if (btn.dataset.adminTab === 'updates' && !state.updatesLoaded && !state.updatesError) {
        retryUpdatesLoad();
      }
      if (btn.dataset.adminTab === 'gallery' && !state.galleryLoaded && !state.galleryError) {
        retryGalleryLoad();
      }
    });
  });

  document.querySelectorAll('[data-open-form]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openForm));
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const submitBtn = event.submitter || event.target.querySelector('button[type="submit"]');
  loginStatus.textContent = 'Memeriksa akun...';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memeriksa...';
  }

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const { error } = await withTimeout(
      adminDb.auth.signInWithPassword({ email, password }),
      15000,
      'Login terlalu lama. Periksa koneksi internet, lalu coba lagi.'
    );
    if (error) {
      loginStatus.textContent = authErrorMessage(error);
      return;
    }
    loginStatus.textContent = 'Login berhasil. Memuat dashboard...';
    await showDashboard();
  } catch (error) {
    loginStatus.textContent = error.message || 'Login gagal karena koneksi bermasalah.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
    }
  }
}

async function handleLogout() {
  await adminDb.auth.signOut();
  showLogin();
}

function showLogin() {
  state.adminUser = null;
  loginView.hidden = false;
  dashboardView.hidden = true;
  if (adminDb) {
    loginStatus.textContent = 'Masukkan email dan password akun admin panitia.';
  }
}

async function showDashboard() {
  const { data: { session } } = await adminDb.auth.getSession();
  const adminUser = await getActiveAdminUser(session);
  if (!adminUser) {
    await adminDb.auth.signOut();
    showLogin();
    loginStatus.textContent = 'Akun ini tidak memiliki akses admin.';
    return;
  }

  loginStatus.textContent = 'Login berhasil. Memuat data admin...';
  state.adminUser = adminUser;
  loginView.hidden = true;
  dashboardView.hidden = false;
  try {
    await withTimeout(
      loadAdminData(),
      25000,
      'Login berhasil, tetapi data admin terlalu lama dimuat. Muat ulang halaman.'
    );
    renderAdmin();
  } catch (error) {
    showToast(error.message || 'Gagal memuat dashboard admin.', true);
    loginStatus.textContent = error.message || 'Gagal memuat dashboard admin.';
  }
}

async function getActiveAdminUser(session) {
  const userId = session?.user?.id;
  if (!userId) return null;

  loginStatus.textContent = 'Memeriksa akses admin...';
  const { data, error } = await withTimeout(
    adminDb
      .from('admin_users')
      .select('id,user_id,email,role,is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1),
    10000,
    'Login berhasil, tetapi pemeriksaan akses admin terlalu lama.'
  );
  if (error) throw new Error(`Gagal memeriksa akses admin: ${error.message}`);
  return data?.[0] || null;
}

async function loadAdminData() {
  const settingsRes = await runAdminQuery(
    'site_settings',
    adminDb.from('site_settings').select('*').eq('id', 1).single()
  );
  const donorsRes = await loadDonorsData();
  const donorsTotalRes = await runAdminQuery(
    'donors total',
    adminDb.from('donors').select('amount')
  );
  const paymentsRes = await runAdminQuery(
    'payment_methods',
    adminDb.from('payment_methods').select('*').order('sort_order', { ascending: true })
  );
  const confirmationsRes = await runAdminQuery(
    'pending_confirmations',
    adminDb.from('pending_confirmations').select('*').order('created_at', { ascending: false })
  );
  const breakdownRes = await runAdminQuery(
    'fund_breakdown',
    adminDb.from('fund_breakdown').select('*').order('sort_order', { ascending: true })
  );
  const contactsRes = await runAdminQuery(
    'contacts',
    adminDb.from('contacts').select('*').order('sort_order', { ascending: true })
  );

  state.settings = settingsRes.data;
  state.donors = donorsRes.data || [];
  state.donorsTotal = donorsRes.count || 0;
  state.donorsTotalAmount = (donorsTotalRes.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  state.confirmations = confirmationsRes.data || [];
  state.breakdown = breakdownRes.data || [];
  state.payments = paymentsRes.data || [];
  state.contacts = contactsRes.data || [];
  state.updates = [];
  state.updatesError = '';
  state.updatesLoaded = false;
  state.gallery = [];
  state.galleryError = '';
  state.galleryLoaded = false;
}

async function loadDonorsData() {
  const offset = (state.donorPage - 1) * DONORS_PAGE_SIZE;
  let query = adminDb
    .from('donors')
    .select('*', { count: 'exact' })
    .order('donation_date', { ascending: false })
    .range(offset, offset + DONORS_PAGE_SIZE - 1);

  if (state.donorSearch) {
    query = query.ilike('name', `%${state.donorSearch}%`);
  }

  return runAdminQuery('donors', query);
}

async function runAdminQuery(label, queryPromise, timeoutMs = 10000) {
  loginStatus.textContent = `Login berhasil. Memuat ${label}...`;
  const result = await withTimeout(
    queryPromise,
    timeoutMs,
    `Login berhasil, tetapi data ${label} terlalu lama dimuat. Periksa koneksi ke Supabase.`
  );
  if (result.error) {
    throw new Error(`Gagal memuat ${label}: ${result.error.message}`);
  }
  return result;
}

async function loadGalleryData({ optional = false } = {}) {
  try {
    const galleryRes = await runAdminQuery(
      'gallery_items',
      adminDb.from('gallery_items').select('id,image_url,caption,sort_order').order('sort_order', { ascending: true }),
      5000
    );
    state.gallery = galleryRes.data || [];
    state.galleryError = '';
    state.galleryLoaded = true;
  } catch (error) {
    state.gallery = [];
    state.galleryError = error.message || 'Galeri belum dapat dimuat.';
    state.galleryLoaded = false;
    if (!optional) throw error;
  }
}

async function loadUpdatesData({ optional = false } = {}) {
  try {
    const updatesRes = await runAdminQuery(
      'building_updates',
      adminDb.from('building_updates').select('*').order('update_date', { ascending: false }),
      5000
    );
    state.updates = updatesRes.data || [];
    state.updatesError = '';
    state.updatesLoaded = true;
  } catch (error) {
    state.updates = [];
    state.updatesError = error.message || 'Update pembangunan belum dapat dimuat.';
    state.updatesLoaded = false;
    if (!optional) throw error;
  }
}

function renderAdmin() {
  renderSummary();
  renderReportForm();
  renderProfileForm();
  renderDonors();
  renderConfirmations();
  renderBreakdown();
  renderPayments();
  renderContacts();
  renderUpdates();
  renderGallery();
}

function renderSummary() {
  const total = Number(state.donorsTotalAmount || 0);
  const target = Number(state.settings?.donation_target || 0);
  const used = Number(state.settings?.funds_used || 0);
  const cards = [
    ['Dana Masuk', formatRupiah(total)],
    ['Jumlah Donatur', state.donorsTotal],
    ['Target', formatRupiah(target)],
    ['Dana Terpakai', formatRupiah(used)],
    ['Saldo', formatRupiah(Math.max(total - used, 0))],
    ['Sisa Target', formatRupiah(Math.max(target - total, 0))],
  ];

  document.getElementById('summary-cards').innerHTML = cards.map(([label, value]) => `
    <article class="admin-summary-card">
      <span>${escHtml(label)}</span>
      <strong>${escHtml(value)}</strong>
    </article>
  `).join('');
}

function renderReportForm() {
  const s = state.settings || {};
  setValue('donation-target', s.donation_target || 0);
  setValue('funds-used', s.funds_used || 0);
  setValue('report-date', s.report_date || today());
  setValue('report-note', s.report_note || '');
  setValue('qris-url', s.qris_url || '');
}

function renderProfileForm() {
  const s = state.settings || {};
  setValue('majelis-name', s.majelis_name || '');
  setValue('majelis-program', s.majelis_program || '');
  setValue('majelis-address', s.majelis_address || '');
  setValue('whatsapp-message', s.whatsapp_message || '');
  setValue('majelis-photo-url', s.majelis_photo_url || '');
}

function renderDonors() {
  const totalPages = Math.max(Math.ceil(state.donorsTotal / DONORS_PAGE_SIZE), 1);
  document.getElementById('donors-body').innerHTML = state.donors.map(item => `
    <tr>
      <td>${escHtml(item.is_anonymous ? 'Hamba Allah' : item.name)}</td>
      <td>${escHtml(formatRupiah(item.amount))}</td>
      <td>${escHtml(formatDate(item.donation_date))}</td>
      <td>${rowActions('donor', item.id)}</td>
    </tr>
  `).join('') || emptyRow(4, 'Belum ada donatur.');
  document.getElementById('donor-pagination').innerHTML = `
    <button type="button" class="admin-btn admin-btn-light" id="donor-prev" ${state.donorPage <= 1 ? 'disabled' : ''}>Sebelumnya</button>
    <span>Halaman ${state.donorPage} dari ${totalPages} (${state.donorsTotal} donatur)</span>
    <button type="button" class="admin-btn admin-btn-light" id="donor-next" ${state.donorPage >= totalPages ? 'disabled' : ''}>Berikutnya</button>
  `;
  document.getElementById('donor-prev').onclick = () => changeDonorPage(state.donorPage - 1);
  document.getElementById('donor-next').onclick = () => changeDonorPage(state.donorPage + 1);
  bindRowActions();
}

function renderPayments() {
  document.getElementById('payments-body').innerHTML = state.payments.map(item => `
    <tr>
      <td>${item.method_type === 'bank' ? 'Bank' : 'E-Wallet'}</td>
      <td>${escHtml(item.name)}</td>
      <td>${escHtml(item.account_number || '-')}</td>
      <td>${escHtml(item.account_name || '-')}</td>
      <td>${escHtml(item.verified_at ? formatDate(item.verified_at) : '-')}</td>
      <td>${rowActions('payment', item.id)}</td>
    </tr>
  `).join('') || emptyRow(6, 'Belum ada metode donasi.');
  bindRowActions();
}

function renderBreakdown() {
  document.getElementById('breakdown-body').innerHTML = state.breakdown.map(item => `
    <tr>
      <td>${escHtml(item.label)}</td>
      <td>${escHtml(formatRupiah(item.amount))}</td>
      <td>${Number(item.sort_order || 0)}</td>
      <td>${rowActions('breakdown', item.id)}</td>
    </tr>
  `).join('') || emptyRow(4, 'Belum ada rincian kebutuhan dana.');
  bindRowActions();
}

function renderConfirmations() {
  document.getElementById('confirmations-body').innerHTML = state.confirmations.map(item => `
    <tr>
      <td>${escHtml(item.name)}</td>
      <td>${escHtml(formatRupiah(item.amount))}</td>
      <td>${escHtml(formatDate(item.donation_date))}</td>
      <td>${escHtml(item.whatsapp || '-')}</td>
      <td>${escHtml(item.status || 'pending')}</td>
      <td>
        <div class="admin-row-actions">
          ${item.proof_url ? `<a class="admin-link-btn" href="${escAttr(item.proof_url)}" target="_blank" rel="noopener">Bukti</a>` : ''}
          ${item.status === 'pending' ? `<button type="button" class="admin-link-btn" data-verify-confirmation="${item.id}">Verifikasi</button>` : ''}
          ${item.status === 'pending' ? `<button type="button" class="admin-link-btn danger" data-reject-confirmation="${item.id}">Tolak</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') || emptyRow(6, 'Belum ada konfirmasi donasi.');
  bindConfirmationActions();
}

function bindConfirmationActions() {
  document.querySelectorAll('[data-verify-confirmation]').forEach(btn => {
    btn.onclick = () => verifyConfirmation(btn.dataset.verifyConfirmation);
  });
  document.querySelectorAll('[data-reject-confirmation]').forEach(btn => {
    btn.onclick = () => rejectConfirmation(btn.dataset.rejectConfirmation);
  });
}

function renderContacts() {
  document.getElementById('contacts-body').innerHTML = state.contacts.map(item => `
    <tr>
      <td>${escHtml(item.role_name)}</td>
      <td>${escHtml(item.person_name)}</td>
      <td>${escHtml(item.whatsapp || '-')}</td>
      <td>${rowActions('contact', item.id)}</td>
    </tr>
  `).join('') || emptyRow(4, 'Belum ada kontak.');
  bindRowActions();
}

function renderUpdates() {
  if (!state.updatesLoaded && !state.updatesError) {
    document.getElementById('updates-body').innerHTML = `
      <tr>
        <td colspan="4" class="admin-empty">
          Update pembangunan belum dimuat.
          <button type="button" class="admin-link-btn" id="retry-updates-btn">Muat Update</button>
        </td>
      </tr>
    `;
    document.getElementById('retry-updates-btn').onclick = retryUpdatesLoad;
    return;
  }

  if (state.updatesError) {
    document.getElementById('updates-body').innerHTML = `
      <tr>
        <td colspan="4" class="admin-empty">
          ${escHtml(state.updatesError)}
          <button type="button" class="admin-link-btn" id="retry-updates-btn">Coba Muat Update</button>
        </td>
      </tr>
    `;
    document.getElementById('retry-updates-btn').onclick = retryUpdatesLoad;
    return;
  }

  document.getElementById('updates-body').innerHTML = state.updates.map(item => `
    <tr>
      <td>${escHtml(formatDate(item.update_date))}</td>
      <td>${escHtml(item.title)}</td>
      <td>${escHtml(shortText(item.description, 80))}</td>
      <td>${rowActions('update', item.id)}</td>
    </tr>
  `).join('') || emptyRow(4, 'Belum ada update pembangunan.');
  bindRowActions();
}

async function retryUpdatesLoad() {
  state.updatesError = '';
  document.getElementById('updates-body').innerHTML = emptyRow(4, 'Memuat update pembangunan...');
  try {
    await loadUpdatesData();
    renderUpdates();
    showToast('Update pembangunan berhasil dimuat.');
  } catch (error) {
    state.updatesError = error.message || 'Update pembangunan belum dapat dimuat.';
    renderUpdates();
    showToast(state.updatesError, true);
  }
}

function renderGallery() {
  if (!state.galleryLoaded && !state.galleryError) {
    document.getElementById('gallery-body').innerHTML = `
      <div class="admin-warning">
        <strong>Galeri belum dimuat.</strong>
        <p>Data galeri dimuat terpisah agar login dashboard tetap cepat.</p>
        <button type="button" class="admin-btn admin-btn-light" id="retry-gallery-btn">Muat Galeri</button>
      </div>
    `;
    document.getElementById('retry-gallery-btn').onclick = retryGalleryLoad;
    return;
  }

  if (state.galleryError) {
    document.getElementById('gallery-body').innerHTML = `
      <div class="admin-warning">
        <strong>Galeri belum dapat dimuat.</strong>
        <p>${escHtml(state.galleryError)}</p>
        <button type="button" class="admin-btn admin-btn-light" id="retry-gallery-btn">Coba Muat Galeri</button>
      </div>
    `;
    document.getElementById('retry-gallery-btn').onclick = retryGalleryLoad;
    return;
  }

  document.getElementById('gallery-body').innerHTML = state.gallery.map(item => `
    <article class="admin-gallery-item">
      <img src="${escHtml(item.image_url)}" alt="${escHtml(item.caption)}" />
      <div>
        <strong>${escHtml(item.caption)}</strong>
        <span>Urutan ${Number(item.sort_order || 0)}</span>
      </div>
      <div class="admin-row-actions">${rowActions('gallery', item.id)}</div>
    </article>
  `).join('') || '<p class="admin-muted">Belum ada foto galeri.</p>';
  bindRowActions();
}

async function retryGalleryLoad() {
  state.galleryError = '';
  document.getElementById('gallery-body').innerHTML = '<p class="admin-muted">Memuat galeri...</p>';
  try {
    await loadGalleryData();
    renderGallery();
    showToast('Galeri berhasil dimuat.');
  } catch (error) {
    state.galleryError = error.message || 'Galeri belum dapat dimuat.';
    renderGallery();
    showToast(state.galleryError, true);
  }
}

function rowActions(type, id) {
  return `
    <div class="admin-row-actions">
      <button type="button" class="admin-link-btn" data-edit="${type}" data-id="${id}">Edit</button>
      <button type="button" class="admin-link-btn danger" data-delete="${type}" data-id="${id}">Hapus</button>
    </div>
  `;
}

function bindRowActions() {
  document.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openModal(btn.dataset.edit, btn.dataset.id);
  });
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = () => deleteItem(btn.dataset.delete, btn.dataset.id);
  });
}

function openModal(type, id = null) {
  state.modalType = type;
  state.editingId = id;
  const record = id ? findRecord(type, id) : null;
  modalTitle.textContent = `${id ? 'Edit' : 'Tambah'} ${modalLabel(type)}`;
  modalFields.innerHTML = modalFieldsHtml(type, record);
  modal.showModal();
}

function closeModal() {
  modal.close();
  modalFields.innerHTML = '';
  state.modalType = '';
  state.editingId = null;
}

function modalFieldsHtml(type, item) {
  if (type === 'donor') {
    return `
      ${field('Nama Donatur', 'name', 'text', item?.name || 'Hamba Allah', true)}
      ${field('Nominal', 'amount', 'number', item?.amount || '', true, '1000')}
      ${field('Tanggal', 'donation_date', 'date', item?.donation_date || today(), true)}
      <label class="admin-check"><input type="checkbox" name="is_anonymous" ${item?.is_anonymous ? 'checked' : ''} /> Tampilkan sebagai Hamba Allah</label>
      <label>Catatan<textarea name="notes" rows="3">${escHtml(item?.notes || '')}</textarea></label>
    `;
  }
  if (type === 'payment') {
    return `
      <label>Tipe
        <select name="method_type" required>
          <option value="bank" ${item?.method_type === 'bank' ? 'selected' : ''}>Bank</option>
          <option value="ewallet" ${item?.method_type === 'ewallet' ? 'selected' : ''}>E-Wallet</option>
        </select>
      </label>
      ${field('Kode', 'code', 'text', item?.code || '', true)}
      ${field('Label', 'label', 'text', item?.label || '', true)}
      ${field('Nama Metode', 'name', 'text', item?.name || '', true)}
      ${field('Nomor/Akun', 'account_number', 'text', item?.account_number || '')}
      ${field('Atas Nama', 'account_name', 'text', item?.account_name || '')}
      ${field('Tanggal Verifikasi', 'verified_at', 'date', item?.verified_at || '')}
      ${field('Urutan', 'sort_order', 'number', item?.sort_order || 0, true)}
      <label class="admin-check"><input type="checkbox" name="is_active" ${item?.is_active !== false ? 'checked' : ''} /> Aktif</label>
    `;
  }
  if (type === 'breakdown') {
    return `
      ${field('Label RAB', 'label', 'text', item?.label || '', true)}
      ${field('Nominal', 'amount', 'number', item?.amount || '', true, '1000')}
      ${field('Urutan', 'sort_order', 'number', item?.sort_order || 0, true)}
    `;
  }
  if (type === 'contact') {
    return `
      ${field('Jabatan', 'role_name', 'text', item?.role_name || '', true)}
      ${field('Nama', 'person_name', 'text', item?.person_name || '', true)}
      ${field('WhatsApp', 'whatsapp', 'text', item?.whatsapp || '', true)}
      ${field('Urutan', 'sort_order', 'number', item?.sort_order || 0, true)}
      <label class="admin-check"><input type="checkbox" name="is_active" ${item?.is_active !== false ? 'checked' : ''} /> Aktif</label>
    `;
  }
  if (type === 'update') {
    return `
      ${field('Tanggal', 'update_date', 'date', item?.update_date || today(), true)}
      ${field('Judul', 'title', 'text', item?.title || '', true)}
      <label>Deskripsi<textarea name="description" rows="4" required>${escHtml(item?.description || '')}</textarea></label>
    `;
  }
  if (type === 'gallery') {
    return `
      ${field('Caption', 'caption', 'text', item?.caption || '', true)}
      ${field('URL Gambar', 'image_url', 'url', item?.image_url || '')}
      <label>Upload Gambar<input type="file" name="image_file" accept="image/*" /></label>
      ${field('Urutan', 'sort_order', 'number', item?.sort_order || 0, true)}
    `;
  }
  return '';
}

function field(label, name, type, value = '', required = false, step = '') {
  return `<label>${label}<input type="${type}" name="${name}" value="${escAttr(value)}" ${required ? 'required' : ''} ${step ? `step="${step}"` : ''} /></label>`;
}

async function handleModalSave(event) {
  event.preventDefault();
  const form = new FormData(modalForm);
  const type = state.modalType;
  let payload = buildPayload(type, form);
  const validation = validatePayload(type, payload);
  if (validation) {
    showToast(validation, true);
    return;
  }

  try {
    if (type === 'gallery') {
      const file = form.get('image_file');
      if (file && file.size > 0) payload.image_url = await uploadAsset(file, 'gallery');
      if (!payload.image_url) throw new Error('URL gambar atau upload gambar wajib diisi.');
    }

    const table = tableName(type);
    const result = state.editingId
      ? await adminDb.from(table).update(payload).eq('id', state.editingId)
      : await adminDb.from(table).insert(payload);

    if (result.error) throw result.error;
    await logAdminAction(state.editingId ? 'update' : 'insert', table, state.editingId, payload);
    closeModal();
    await loadAdminData();
    renderAdmin();
    showToast('Data berhasil disimpan.');
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan data.', true);
  }
}

function buildPayload(type, form) {
  if (type === 'donor') {
    return {
      name: clean(form.get('name')),
      amount: Number(form.get('amount')),
      donation_date: clean(form.get('donation_date')),
      is_anonymous: form.get('is_anonymous') === 'on',
      notes: clean(form.get('notes')),
    };
  }
  if (type === 'payment') {
    return {
      method_type: clean(form.get('method_type')),
      code: clean(form.get('code')).toLowerCase(),
      label: clean(form.get('label')),
      name: clean(form.get('name')),
      account_number: clean(form.get('account_number')),
      account_name: clean(form.get('account_name')),
      verified_at: clean(form.get('verified_at')) || null,
      sort_order: Number(form.get('sort_order') || 0),
      is_active: form.get('is_active') === 'on',
    };
  }
  if (type === 'breakdown') {
    return {
      label: clean(form.get('label')),
      amount: Number(form.get('amount')),
      sort_order: Number(form.get('sort_order') || 0),
    };
  }
  if (type === 'contact') {
    return {
      role_name: clean(form.get('role_name')),
      person_name: clean(form.get('person_name')),
      whatsapp: clean(form.get('whatsapp')),
      sort_order: Number(form.get('sort_order') || 0),
      is_active: form.get('is_active') === 'on',
    };
  }
  if (type === 'update') {
    return {
      update_date: clean(form.get('update_date')),
      title: clean(form.get('title')),
      description: clean(form.get('description')),
    };
  }
  if (type === 'gallery') {
    return {
      caption: clean(form.get('caption')),
      image_url: clean(form.get('image_url')),
      sort_order: Number(form.get('sort_order') || 0),
    };
  }
  return {};
}

function validatePayload(type, payload) {
  if (type === 'donor' && (!payload.name || payload.amount <= 0 || !payload.donation_date)) {
    return 'Nama, nominal positif, dan tanggal donatur wajib diisi.';
  }
  if (type === 'payment' && (!payload.code || !payload.label || !payload.name)) {
    return 'Kode, label, dan nama metode donasi wajib diisi.';
  }
  if (type === 'payment' && payload.account_number && !payload.account_name) {
    return 'Atas nama wajib diisi jika nomor akun diisi.';
  }
  if (type === 'breakdown' && (!payload.label || payload.amount < 0)) {
    return 'Label dan nominal RAB wajib valid.';
  }
  if (type === 'contact' && (!payload.role_name || !payload.person_name || !isValidWhatsapp(payload.whatsapp))) {
    return 'Kontak wajib memakai nama, jabatan, dan WhatsApp format 628...';
  }
  if (type === 'update' && (!payload.update_date || !payload.title || !payload.description)) {
    return 'Tanggal, judul, dan deskripsi update wajib diisi.';
  }
  if (type === 'gallery' && !payload.caption) {
    return 'Caption foto wajib diisi.';
  }
  return '';
}

async function handleReportSave(event) {
  event.preventDefault();
  try {
    let qrisUrl = value('qris-url');
    const file = document.getElementById('qris-file').files[0];
    if (file) qrisUrl = await uploadAsset(file, 'qris');

    const payload = {
      donation_target: Number(value('donation-target')),
      funds_used: Number(value('funds-used')),
      report_date: value('report-date'),
      report_note: value('report-note'),
      qris_url: qrisUrl,
    };

    if (payload.donation_target < 0 || payload.funds_used < 0 || !payload.report_date || !payload.report_note) {
      showToast('Target, dana terpakai, tanggal, dan catatan laporan wajib valid.', true);
      return;
    }

    await saveSettings(payload);
    showToast('Laporan dana berhasil disimpan.');
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan laporan.', true);
  }
}

async function handleProfileSave(event) {
  event.preventDefault();
  try {
    let photoUrl = value('majelis-photo-url');
    const file = document.getElementById('majelis-photo-file').files[0];
    if (file) photoUrl = await uploadAsset(file, 'majelis');

    const payload = {
      majelis_name: value('majelis-name'),
      majelis_program: value('majelis-program'),
      majelis_address: value('majelis-address'),
      whatsapp_message: value('whatsapp-message'),
      majelis_photo_url: photoUrl,
    };

    if (!payload.majelis_name || !payload.majelis_program || !payload.majelis_address || !payload.whatsapp_message) {
      showToast('Nama, program, alamat, dan pesan WhatsApp wajib diisi.', true);
      return;
    }

    await saveSettings(payload);
    showToast('Profil majelis berhasil disimpan.');
  } catch (error) {
    showToast(error.message || 'Gagal menyimpan profil.', true);
  }
}

async function saveSettings(payload) {
  const { error } = await adminDb.from('site_settings').update(payload).eq('id', 1);
  if (error) throw error;
  await logAdminAction('update', 'site_settings', '1', payload);
  await loadAdminData();
  renderAdmin();
}

async function deleteItem(type, id) {
  const itemName = modalLabel(type).toLowerCase();
  if (!confirm(`Hapus ${itemName} ini?`)) return;
  const { error } = await adminDb.from(tableName(type)).delete().eq('id', id);
  if (error) {
    showToast(error.message || 'Gagal menghapus data.', true);
    return;
  }
  await logAdminAction('delete', tableName(type), id, null);
  await loadAdminData();
  renderAdmin();
  showToast('Data berhasil dihapus.');
}

async function uploadAsset(file, folder) {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 3 MB.');
  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await adminDb.storage.from(SUPABASE_CONFIG.storageBucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data } = adminDb.storage.from(SUPABASE_CONFIG.storageBucket).getPublicUrl(path);
  return data.publicUrl;
}

async function handleDonorSearch(event) {
  state.donorSearch = event.target.value.trim();
  state.donorPage = 1;
  try {
    const donorsRes = await loadDonorsData();
    state.donors = donorsRes.data || [];
    state.donorsTotal = donorsRes.count || 0;
    renderSummary();
    renderDonors();
  } catch (error) {
    showToast(error.message || 'Gagal mencari donatur.', true);
  }
}

async function changeDonorPage(page) {
  state.donorPage = Math.max(page, 1);
  try {
    const donorsRes = await loadDonorsData();
    state.donors = donorsRes.data || [];
    state.donorsTotal = donorsRes.count || 0;
    renderDonors();
  } catch (error) {
    showToast(error.message || 'Gagal memuat halaman donatur.', true);
  }
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportDonorsCsv() {
  const rows = [['Nama', 'Nominal', 'Tanggal', 'Anonim', 'Catatan']];
  state.donors.forEach(d => {
    rows.push([
      d.is_anonymous ? 'Hamba Allah' : d.name,
      d.amount,
      d.donation_date,
      d.is_anonymous ? 'Ya' : 'Tidak',
      d.notes || '',
    ]);
  });
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `donatur-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

async function retryConfirmationsLoad() {
  try {
    const confirmationsRes = await runAdminQuery(
      'pending_confirmations',
      adminDb.from('pending_confirmations').select('*').order('created_at', { ascending: false })
    );
    state.confirmations = confirmationsRes.data || [];
    renderConfirmations();
    showToast('Konfirmasi donasi berhasil dimuat.');
  } catch (error) {
    showToast(error.message || 'Gagal memuat konfirmasi donasi.', true);
  }
}

async function verifyConfirmation(id) {
  const item = state.confirmations.find(row => String(row.id) === String(id));
  if (!item) return;
  const donorPayload = {
    name: item.name,
    amount: Number(item.amount || 0),
    donation_date: item.donation_date,
    notes: `Konfirmasi WhatsApp ${item.whatsapp || '-'}${item.notes ? ` - ${item.notes}` : ''}`,
  };
  const donorRes = await adminDb.from('donors').insert(donorPayload);
  if (donorRes.error) {
    showToast(donorRes.error.message || 'Gagal membuat data donatur.', true);
    return;
  }
  const confirmationRes = await adminDb
    .from('pending_confirmations')
    .update({ status: 'verified' })
    .eq('id', id);
  if (confirmationRes.error) {
    showToast(confirmationRes.error.message || 'Gagal memperbarui konfirmasi.', true);
    return;
  }
  await logAdminAction('verify', 'pending_confirmations', id, donorPayload);
  await loadAdminData();
  renderAdmin();
  showToast('Konfirmasi diverifikasi dan masuk daftar donatur.');
}

async function rejectConfirmation(id) {
  const notes = prompt('Catatan penolakan (opsional):') || '';
  const { error } = await adminDb
    .from('pending_confirmations')
    .update({ status: 'rejected', notes: notes.trim() })
    .eq('id', id);
  if (error) {
    showToast(error.message || 'Gagal menolak konfirmasi.', true);
    return;
  }
  await logAdminAction('reject', 'pending_confirmations', id, { notes: notes.trim() });
  await retryConfirmationsLoad();
  showToast('Konfirmasi ditolak.');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

async function importDonorsCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map(parseCsvLine).map(([name, amount, donationDate, isAnonymous = '', notes = '']) => ({
      name: clean(name) || 'Hamba Allah',
      amount: Number(String(amount).replace(/[^0-9.-]/g, '')),
      donation_date: clean(donationDate) || today(),
      is_anonymous: /^ya|true|1$/i.test(clean(isAnonymous)),
      notes: clean(notes),
    })).filter(row => row.amount > 0 && row.donation_date);
    if (rows.length === 0) throw new Error('CSV tidak berisi data donatur valid.');
    const { error } = await adminDb.from('donors').insert(rows);
    if (error) throw error;
    await logAdminAction('bulk_import', 'donors', null, { count: rows.length });
    await loadAdminData();
    renderAdmin();
    showToast(`${rows.length} donatur berhasil diimport.`);
  } catch (error) {
    showToast(error.message || 'Import CSV gagal.', true);
  } finally {
    event.target.value = '';
  }
}

async function logAdminAction(action, tableNameValue, recordId = null, payload = null) {
  if (!adminDb || !state.adminUser) return;
  const { error } = await adminDb.from('admin_logs').insert({
    action,
    table_name: tableNameValue,
    record_id: recordId ? String(recordId) : null,
    admin_email: state.adminUser.email || '',
    payload,
  });
  if (error) console.warn('Gagal mencatat audit log:', error.message);
}

function activateTab(name) {
  document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.adminTab === name));
  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${name}`));
}

function findRecord(type, id) {
  return collection(type).find(item => String(item.id) === String(id));
}

function collection(type) {
  return {
    donor: state.donors,
    breakdown: state.breakdown,
    payment: state.payments,
    contact: state.contacts,
    update: state.updates,
    gallery: state.gallery,
  }[type] || [];
}

function tableName(type) {
  return {
    donor: 'donors',
    breakdown: 'fund_breakdown',
    payment: 'payment_methods',
    contact: 'contacts',
    update: 'building_updates',
    gallery: 'gallery_items',
  }[type];
}

function modalLabel(type) {
  return {
    donor: 'Donatur',
    breakdown: 'Rincian Dana',
    payment: 'Metode Donasi',
    contact: 'Kontak',
    update: 'Update Pembangunan',
    gallery: 'Foto Galeri',
  }[type] || 'Data';
}

function emptyRow(cols, text) {
  return `<tr><td colspan="${cols}" class="admin-empty">${text}</td></tr>`;
}

function value(id) {
  return document.getElementById(id).value.trim();
}

function setValue(id, val) {
  document.getElementById(id).value = val ?? '';
}

function clean(val) {
  return String(val ?? '').trim();
}

function isValidWhatsapp(number) {
  return /^628[0-9]{8,15}$/.test(number);
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortText(text, max) {
  const value = String(text || '');
  return value.length > max ? value.slice(0, max - 1) + '...' : value;
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function authErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Login gagal. Periksa email dan password.';
  }
  if (message.includes('email not confirmed')) {
    return 'Email admin belum dikonfirmasi di Supabase Auth.';
  }
  return error?.message || 'Login gagal. Coba beberapa saat lagi.';
}
