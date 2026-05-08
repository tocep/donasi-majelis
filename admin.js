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
  breakdownItems: {},
  openBreakdownId: null,
  openParentBreakdownId: null,
  payments: [],
  contacts: [],
  updates: [],
  updatesError: '',
  updatesLoaded: false,
  gallery: [],
  galleryError: '',
  galleryLoaded: false,
  accounts: {
    list: [],
    transfers: [],
    allDonors: [],
    allExpenses: [],
    loaded: false,
    error: '',
  },
  finance: {
    loaded: false,
    error: '',
    filter: { mode: 'month', yearMonth: null, dateFrom: null, dateTo: null },
    categories: [],
    donors: [],
    expenses: [],
    prevBalance: 0,
  },
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

  loginStatus.textContent = '';
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
      if (btn.dataset.adminTab === 'finance' && !state.finance.loaded && !state.finance.error) {
        const ym = today().slice(0, 7);
        state.finance.filter = { mode: 'month', yearMonth: ym, dateFrom: null, dateTo: null };
        loadAndRenderFinance();
      }
      if (btn.dataset.adminTab === 'accounts' && !state.accounts.loaded && !state.accounts.error) {
        loadAccountsSection();
      }
    });
  });

  document.querySelectorAll('[data-open-form]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.openForm));
  });

  document.getElementById('finance-month-select').addEventListener('change', function () {
    state.finance.filter = { mode: 'month', yearMonth: this.value, dateFrom: null, dateTo: null };
    loadAndRenderFinance();
  });
  document.getElementById('finance-apply-btn').addEventListener('click', function () {
    const from = document.getElementById('finance-date-from').value;
    const to = document.getElementById('finance-date-to').value;
    if (!from || !to) { showToast('Pilih tanggal mulai dan selesai.', true); return; }
    if (from > to) { showToast('Tanggal mulai tidak boleh setelah tanggal selesai.', true); return; }
    state.finance.filter = { mode: 'range', yearMonth: null, dateFrom: from, dateTo: to };
    loadAndRenderFinance();
  });
  document.getElementById('finance-all-btn').addEventListener('click', function () {
    state.finance.filter = { mode: 'all', yearMonth: null, dateFrom: null, dateTo: null };
    loadAndRenderFinance();
  });
  document.getElementById('finance-print-btn').addEventListener('click', printFinanceReport);
  document.getElementById('finance-csv-btn').addEventListener('click', exportFinanceCsv);
  document.getElementById('finance-add-expense-btn').addEventListener('click', function () {
    openModal('expense');
  });
  document.getElementById('finance-manage-cat-btn').addEventListener('click', openCategoryManager);
  document.getElementById('accounts-migrate-btn').addEventListener('click', openMigrateModal);
  document.getElementById('accounts-transfer-btn').addEventListener('click', () => openModal('transfer'));
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
  const breakdownItemsRes = await runAdminQuery(
    'fund_breakdown_items',
    adminDb.from('fund_breakdown_items').select('*').order('sort_order', { ascending: true })
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
  const rawItems = breakdownItemsRes.data || [];
  state.breakdownItems = {};
  rawItems.forEach(function(item) {
    if (!state.breakdownItems[item.breakdown_id]) state.breakdownItems[item.breakdown_id] = [];
    state.breakdownItems[item.breakdown_id].push(item);
  });
  state.payments = paymentsRes.data || [];
  state.contacts = contactsRes.data || [];
  const accountsRes = await runAdminQuery(
    'accounts',
    adminDb.from('accounts').select('*').order('sort_order', { ascending: true })
  );
  state.accounts.list = accountsRes.data || [];
  state.accounts.loaded = false;
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

async function loadAccountsData() {
  const [transfersRes, donorsRes, expensesRes] = await Promise.all([
    adminDb.from('account_transfers').select('*').order('transfer_date', { ascending: false }),
    adminDb.from('donors').select('id, amount, account_id'),
    adminDb.from('expenses').select('id, amount, account_id'),
  ]);
  if (transfersRes.error) throw transfersRes.error;
  if (donorsRes.error) throw donorsRes.error;
  if (expensesRes.error) throw expensesRes.error;
  state.accounts.transfers = transfersRes.data || [];
  state.accounts.allDonors = donorsRes.data || [];
  state.accounts.allExpenses = expensesRes.data || [];
  state.accounts.error = '';
  state.accounts.loaded = true;
}

async function loadAccountsSection() {
  try {
    await loadAccountsData();
    renderAccounts();
  } catch (error) {
    state.accounts.error = error.message || 'Data rekening belum dapat dimuat.';
    renderAccounts();
  }
}

async function retryAccountsLoad() {
  state.accounts.error = '';
  renderAccounts();
  try {
    await loadAccountsData();
    renderAccounts();
    showToast('Data rekening berhasil dimuat.');
  } catch (error) {
    state.accounts.error = error.message || 'Data rekening belum dapat dimuat.';
    renderAccounts();
    showToast(state.accounts.error, true);
  }
}

function calcBalance(accountId) {
  const income = state.accounts.allDonors
    .filter(d => d.account_id === accountId)
    .reduce((s, d) => s + Number(d.amount || 0), 0);
  const outcome = state.accounts.allExpenses
    .filter(e => e.account_id === accountId)
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const transferIn = state.accounts.transfers
    .filter(t => t.to_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const transferOut = state.accounts.transfers
    .filter(t => t.from_account_id === accountId)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  return income - outcome + transferIn - transferOut;
}

function renderAccounts() {
  const cardsWrap = document.getElementById('accounts-cards-wrap');
  const transferBody = document.getElementById('accounts-transfers-body');
  if (!state.accounts.loaded && !state.accounts.error) {
    cardsWrap.textContent = '';
    const p = document.createElement('p');
    p.className = 'admin-muted';
    p.textContent = 'Memuat rekening...';
    cardsWrap.appendChild(p);
    transferBody.replaceChildren();
    return;
  }
  if (state.accounts.error) {
    cardsWrap.textContent = '';
    const div = document.createElement('div');
    div.className = 'admin-warning';
    const strong = document.createElement('strong');
    strong.textContent = 'Data rekening belum dapat dimuat.';
    const p = document.createElement('p');
    p.className = 'admin-muted';
    p.textContent = state.accounts.error;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-btn admin-btn-light';
    btn.textContent = 'Coba Muat Ulang';
    btn.onclick = retryAccountsLoad;
    div.appendChild(strong);
    div.appendChild(p);
    div.appendChild(btn);
    cardsWrap.appendChild(div);
    return;
  }
  renderAccountCards();
  renderTransferTable();
}

function renderAccountCards() {
  const cardsWrap = document.getElementById('accounts-cards-wrap');
  cardsWrap.textContent = '';
  const activeAccounts = state.accounts.list.filter(a => a.is_active);

  activeAccounts.forEach(acc => {
    const balance = calcBalance(acc.id);
    const card = document.createElement('div');
    card.className = 'admin-card admin-account-card';

    const head = document.createElement('div');
    head.className = 'admin-card-head';

    const titleWrap = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = acc.name;
    const typeBadge = document.createElement('span');
    typeBadge.className = 'admin-badge';
    typeBadge.textContent = acc.type === 'bank' ? 'Bank' : acc.type === 'ewallet' ? 'E-Wallet' : 'Kas Tunai';
    titleWrap.appendChild(h3);
    titleWrap.appendChild(typeBadge);

    const actions = document.createElement('div');
    actions.className = 'admin-card-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'admin-btn admin-btn-light';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openModal('account', acc.id);
    const deactivateBtn = document.createElement('button');
    deactivateBtn.type = 'button';
    deactivateBtn.className = 'admin-btn admin-btn-light';
    deactivateBtn.textContent = 'Nonaktifkan';
    deactivateBtn.onclick = () => deactivateAccount(acc.id);
    actions.appendChild(editBtn);
    actions.appendChild(deactivateBtn);

    head.appendChild(titleWrap);
    head.appendChild(actions);

    const balanceEl = document.createElement('p');
    balanceEl.className = 'admin-account-balance';
    balanceEl.textContent = formatRupiah(balance);

    card.appendChild(head);
    card.appendChild(balanceEl);
    cardsWrap.appendChild(card);
  });

  const unassignedIncome = state.accounts.allDonors
    .filter(d => !d.account_id)
    .reduce((s, d) => s + Number(d.amount || 0), 0);
  const unassignedExpense = state.accounts.allExpenses
    .filter(e => !e.account_id)
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  if (unassignedIncome > 0 || unassignedExpense > 0) {
    const card = document.createElement('div');
    card.className = 'admin-card admin-account-card admin-account-card--unassigned';

    const head = document.createElement('div');
    head.className = 'admin-card-head';
    const h3 = document.createElement('h3');
    h3.textContent = 'Belum Ditentukan';
    const migrateBtn = document.createElement('button');
    migrateBtn.type = 'button';
    migrateBtn.className = 'admin-btn admin-btn-primary';
    migrateBtn.textContent = 'Lengkapi Data';
    migrateBtn.onclick = openMigrateModal;
    head.appendChild(h3);
    head.appendChild(migrateBtn);

    const incomeEl = document.createElement('p');
    incomeEl.className = 'admin-muted';
    incomeEl.textContent = 'Pemasukan: ' + formatRupiah(unassignedIncome);
    const expenseEl = document.createElement('p');
    expenseEl.className = 'admin-muted';
    expenseEl.textContent = 'Pengeluaran: ' + formatRupiah(unassignedExpense);

    card.appendChild(head);
    card.appendChild(incomeEl);
    card.appendChild(expenseEl);
    cardsWrap.appendChild(card);
  }

  if (!activeAccounts.length && !unassignedIncome && !unassignedExpense) {
    const p = document.createElement('p');
    p.className = 'admin-muted';
    p.textContent = 'Belum ada rekening aktif. Klik "Tambah Rekening" untuk mulai.';
    cardsWrap.appendChild(p);
  }
}

function renderTransferTable() {
  const transfers = state.accounts.transfers;
  const accountMap = Object.fromEntries(state.accounts.list.map(a => [a.id, a.name]));
  const tbody = document.getElementById('accounts-transfers-body');
  tbody.replaceChildren();
  if (!transfers.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'admin-empty';
    td.textContent = 'Belum ada transfer antar rekening.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  transfers.forEach(t => {
    const tr = document.createElement('tr');
    [formatDate(t.transfer_date),
     accountMap[t.from_account_id] || '?',
     accountMap[t.to_account_id] || '?',
     formatRupiah(t.amount),
     t.notes || '—'].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });
    const actionTd = document.createElement('td');
    actionTd.innerHTML = rowActions('transfer', t.id);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
  bindRowActions();
}

async function deactivateAccount(id) {
  const acc = state.accounts.list.find(a => String(a.id) === String(id));
  if (!acc) return;
  if (!confirm('Nonaktifkan rekening "' + acc.name + '"? Rekening tidak akan muncul di dropdown baru, tetapi riwayat transaksi tetap tersimpan.')) return;
  const { error } = await adminDb.from('accounts').update({ is_active: false }).eq('id', id);
  if (error) { showToast(error.message || 'Gagal menonaktifkan rekening.', true); return; }
  await logAdminAction('deactivate', 'accounts', id, { is_active: false });
  const accRes = await adminDb.from('accounts').select('*').order('sort_order', { ascending: true });
  if (!accRes.error) state.accounts.list = accRes.data || [];
  state.accounts.loaded = false;
  await loadAccountsData();
  renderAccounts();
  showToast('Rekening berhasil dinonaktifkan.');
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
  const target = state.breakdown.reduce((s, b) => {
    const subs = state.breakdownItems[b.id] || [];
    return s + (subs.length > 0
      ? subs.reduce((ss, si) => ss + Number(si.amount || 0), 0)
      : Number(b.amount || 0));
  }, 0);
  const used = state.breakdown.reduce((s, b) => {
    const subs = state.breakdownItems[b.id] || [];
    return s + (subs.length > 0
      ? subs.reduce((ss, si) => ss + Number(si.realization_amount || 0), 0)
      : Number(b.realization_amount || 0));
  }, 0);
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
  if (!state.breakdown.length) {
    document.getElementById('breakdown-body').innerHTML = emptyRow(6, 'Belum ada rincian kebutuhan dana.');
    return;
  }
  const rows = state.breakdown.map(item => {
    const subItems = state.breakdownItems[item.id] || [];
    const amt = subItems.length > 0
      ? subItems.reduce((s, si) => s + Number(si.amount || 0), 0)
      : Number(item.amount || 0);
    const real = subItems.length > 0
      ? subItems.reduce((s, si) => s + Number(si.realization_amount || 0), 0)
      : Number(item.realization_amount || 0);
    const sisa = amt - real;
    const isOpen = state.openBreakdownId === item.id;
    const subLabel = subItems.length
      ? (isOpen ? 'Tutup Sub' : `Sub (${subItems.length})`)
      : '+ Sub';
    let html = `<tr>
      <td>${escHtml(item.label)}</td>
      <td>${escHtml(formatRupiah(amt))}</td>
      <td>${escHtml(formatRupiah(real))}</td>
      <td>${escHtml(formatRupiah(sisa))}</td>
      <td>${Number(item.sort_order || 0)}</td>
      <td>
        <div class="admin-row-actions">
          <button type="button" class="admin-link-btn" data-edit="breakdown" data-id="${escAttr(item.id)}">Edit</button>
          <button type="button" class="admin-link-btn danger" data-delete="breakdown" data-id="${escAttr(item.id)}">Hapus</button>
          <button type="button" class="admin-link-btn" data-sub-breakdown="${escAttr(item.id)}">${escHtml(subLabel)}</button>
        </div>
      </td>
    </tr>`;
    if (isOpen) html += renderBreakdownSubPanel(item.id);
    return html;
  });
  document.getElementById('breakdown-body').innerHTML = rows.join('');
  bindRowActions();
  bindBreakdownSubActions();
}

function renderBreakdownSubPanel(breakdownId) {
  const subItems = state.breakdownItems[breakdownId] || [];
  const addBtn = `<button type="button" class="admin-link-btn" data-add-sub="${escAttr(breakdownId)}">+ Tambah Sub-item</button>`;
  if (!subItems.length) {
    return `<tr><td colspan="6" style="background:#f9fafb;padding:8px 16px;font-size:13px;">Belum ada sub-item. ${addBtn}</td></tr>`;
  }
  const subRows = subItems.map(sub => {
    const real = Number(sub.realization_amount || 0);
    const amt  = Number(sub.amount || 0);
    return `<tr style="background:#f0f4ff;font-size:13px;">
      <td style="padding-left:32px">↳ ${escHtml(sub.label)}</td>
      <td>${escHtml(formatRupiah(amt))}</td>
      <td>${escHtml(formatRupiah(real))}</td>
      <td>${escHtml(formatRupiah(amt - real))}</td>
      <td>${Number(sub.sort_order || 0)}</td>
      <td>
        <div class="admin-row-actions">
          <button type="button" class="admin-link-btn" data-edit="breakdown_item" data-id="${escAttr(sub.id)}" data-parent="${escAttr(breakdownId)}">Edit</button>
          <button type="button" class="admin-link-btn danger" data-delete="breakdown_item" data-id="${escAttr(sub.id)}">Hapus</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return subRows + `<tr style="background:#f9fafb;"><td colspan="6" style="padding:4px 16px;font-size:13px;">${addBtn}</td></tr>`;
}

function bindBreakdownSubActions() {
  document.querySelectorAll('[data-sub-breakdown]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.subBreakdown;
      state.openBreakdownId = state.openBreakdownId === id ? null : id;
      renderBreakdown();
    };
  });
  document.querySelectorAll('[data-add-sub]').forEach(btn => {
    btn.onclick = () => {
      state.openParentBreakdownId = btn.dataset.addSub;
      openModal('breakdown_item');
    };
  });
  document.querySelectorAll('[data-edit="breakdown_item"]').forEach(btn => {
    btn.onclick = () => {
      state.openParentBreakdownId = btn.dataset.parent;
      openModal('breakdown_item', btn.dataset.id);
    };
  });
  document.querySelectorAll('[data-delete="breakdown_item"]').forEach(btn => {
    btn.onclick = () => deleteItem('breakdown_item', btn.dataset.id);
  });
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
    const hasSubs = item?.id && (state.breakdownItems[item.id] || []).length > 0;
    return `
      ${field('Label RAB', 'label', 'text', item?.label || '', true)}
      ${hasSubs
        ? `<p class="admin-muted" style="margin:4px 0 8px">Nominal RAB dihitung otomatis dari sub-item.</p>`
        : field('Nominal RAB', 'amount', 'number', item?.amount || '', true, '1000')}
      ${hasSubs
        ? `<p class="admin-muted" style="margin:4px 0 8px">Terealisasi dihitung otomatis dari sub-item.</p>`
        : field('Terealisasi', 'realization_amount', 'number', item?.realization_amount || 0, false, '1000')}
      ${field('Urutan', 'sort_order', 'number', item?.sort_order || 0, true)}
    `;
  }
  if (type === 'breakdown_item') {
    return `
      ${field('Label Sub-item', 'label', 'text', item?.label || '', true)}
      ${field('Nominal', 'amount', 'number', item?.amount || '', true, '1000')}
      ${field('Terealisasi', 'realization_amount', 'number', item?.realization_amount || 0, false, '1000')}
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
  if (type === 'expense') {
    const rabCats = state.finance.categories.filter(c => c.breakdown_id);
    const customCats = state.finance.categories.filter(c => !c.breakdown_id);
    const rabOptions = rabCats.map(c =>
      `<option value="${escAttr(c.id)}" ${item?.category_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');
    const customOptions = customCats.map(c =>
      `<option value="${escAttr(c.id)}" ${item?.category_id === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');
    return `
      ${field('Tanggal Pengeluaran', 'expense_date', 'date', item?.expense_date || today(), true)}
      ${field('Nominal (Rp)', 'amount', 'number', item?.amount || '', true, '1000')}
      <label>Kategori
        <select name="category_id" required>
          <option value="" disabled ${!item ? 'selected' : ''}>— Pilih Kategori —</option>
          ${rabOptions ? `<optgroup label="Dari Pos RAB">${rabOptions}</optgroup>` : ''}
          ${customOptions ? `<optgroup label="Kategori Kustom">${customOptions}</optgroup>` : ''}
        </select>
      </label>
      ${field('Keterangan', 'description', 'text', item?.description || '', true)}
      <label>Catatan<textarea name="notes" rows="3">${escHtml(item?.notes || '')}</textarea></label>
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
  if (type === 'expense-category') {
    await handleCategoryAdd(form);
    return;
  }
  if (type === 'migrate-accounts') {
    await saveMigrateData();
    return;
  }
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
    if (type === 'account' || type === 'transfer') {
      const accRes = await adminDb.from('accounts').select('*').order('sort_order', { ascending: true });
      if (!accRes.error) state.accounts.list = accRes.data || [];
      state.accounts.loaded = false;
      await loadAccountsData();
      renderAccounts();
    } else if (type === 'expense') {
      state.finance.loaded = false;
      state.accounts.loaded = false;
      await loadAndRenderFinance();
    } else {
      state.accounts.loaded = false;
      await loadAdminData();
      renderAdmin();
    }
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
      realization_amount: Number(form.get('realization_amount') || 0),
      sort_order: Number(form.get('sort_order') || 0),
    };
  }
  if (type === 'breakdown_item') {
    return {
      breakdown_id: state.openParentBreakdownId,
      label: clean(form.get('label')),
      amount: Number(form.get('amount')),
      realization_amount: Number(form.get('realization_amount') || 0),
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
  if (type === 'expense') {
    return {
      category_id: clean(form.get('category_id')),
      expense_date: clean(form.get('expense_date')),
      amount: Number(form.get('amount')),
      description: clean(form.get('description')),
      notes: clean(form.get('notes')),
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
  if (type === 'breakdown_item' && (!payload.label || payload.amount < 0 || !payload.breakdown_id)) {
    return 'Label, nominal, dan pos RAB induk wajib valid.';
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
  if (type === 'expense' && (!payload.category_id || !payload.expense_date || payload.amount <= 0 || !payload.description)) {
    return 'Tanggal, nominal positif, kategori, dan keterangan pengeluaran wajib diisi.';
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
      report_date: value('report-date'),
      report_note: value('report-note'),
      qris_url: qrisUrl,
    };

    if (!payload.report_date || !payload.report_note) {
      showToast('Tanggal dan catatan laporan wajib diisi.', true);
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
  if (type === 'expense') {
    state.finance.loaded = false;
    state.accounts.loaded = false;
    await loadAndRenderFinance();
  } else if (type === 'transfer') {
    state.accounts.loaded = false;
    await loadAccountsData();
    renderAccounts();
  } else {
    state.accounts.loaded = false;
    await loadAdminData();
    renderAdmin();
  }
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
    breakdown_item: Object.values(state.breakdownItems).flat(),
    expense: state.finance.expenses,
    account: state.accounts.list,
    transfer: state.accounts.transfers,
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
    breakdown_item: 'fund_breakdown_items',
    expense: 'expenses',
    account: 'accounts',
    transfer: 'account_transfers',
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
    breakdown_item: 'Sub-item RAB',
    expense: 'Pengeluaran',
    account: 'Rekening',
    transfer: 'Transfer',
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

async function loadAndRenderFinance() {
  try {
    if (!state.finance.loaded) {
      await loadFinanceCategories();
      await syncRabCategories();
    }
    await loadFinanceData();
    state.finance.loaded = true;
    state.finance.error = '';
    renderFinance();
  } catch (error) {
    state.finance.error = error.message || 'Laporan keuangan gagal dimuat.';
    showToast(state.finance.error, true);
  }
}

async function loadFinanceCategories() {
  const { data, error } = await adminDb
    .from('expense_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  state.finance.categories = data || [];
}

async function syncRabCategories() {
  const existingMap = Object.fromEntries(
    state.finance.categories
      .filter(c => c.breakdown_id)
      .map(c => [c.breakdown_id, c])
  );
  for (const rab of state.breakdown) {
    const existing = existingMap[rab.id];
    if (!existing) {
      await adminDb.from('expense_categories').insert({
        name: rab.label,
        breakdown_id: rab.id,
        sort_order: rab.sort_order,
      });
    } else if (existing.name !== rab.label) {
      await adminDb.from('expense_categories').update({ name: rab.label }).eq('id', existing.id);
    }
  }
  await loadFinanceCategories();
}

async function loadFinanceData() {
  const f = state.finance.filter;
  let dateFrom = null;
  let dateTo = null;

  if (f.mode === 'month' && f.yearMonth) {
    const [y, m] = f.yearMonth.split('-').map(Number);
    dateFrom = `${f.yearMonth}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    dateTo = `${f.yearMonth}-${String(lastDay).padStart(2, '0')}`;
  } else if (f.mode === 'range') {
    dateFrom = f.dateFrom;
    dateTo = f.dateTo;
  }

  let donorQ = adminDb.from('donors').select('*').order('donation_date', { ascending: false });
  if (dateFrom) donorQ = donorQ.gte('donation_date', dateFrom);
  if (dateTo) donorQ = donorQ.lte('donation_date', dateTo);

  let expenseQ = adminDb
    .from('expenses')
    .select('*, expense_categories(id, name, breakdown_id)')
    .order('expense_date', { ascending: false });
  if (dateFrom) expenseQ = expenseQ.gte('expense_date', dateFrom);
  if (dateTo) expenseQ = expenseQ.lte('expense_date', dateTo);

  let prevBalance = 0;
  if (f.mode !== 'all' && dateFrom) {
    const prevDate = new Date(dateFrom);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevTo = prevDate.toISOString().slice(0, 10);
    const [pd, pe] = await Promise.all([
      adminDb.from('donors').select('amount').lte('donation_date', prevTo),
      adminDb.from('expenses').select('amount').lte('expense_date', prevTo),
    ]);
    const prevDonors = (pd.data || []).reduce((s, d) => s + Number(d.amount || 0), 0);
    const prevExp = (pe.data || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    prevBalance = prevDonors - prevExp;
  }

  const [donorRes, expenseRes] = await Promise.all([donorQ, expenseQ]);
  if (donorRes.error) throw donorRes.error;
  if (expenseRes.error) throw expenseRes.error;

  state.finance.donors = donorRes.data || [];
  state.finance.expenses = expenseRes.data || [];
  state.finance.prevBalance = prevBalance;
}

function renderFinance() {
  renderFinanceFilter();
  renderFinanceCards();
  renderFinanceDonors();
  renderFinanceExpenses();
}

function periodLabel(f) {
  if (f.mode === 'all') return 'Menampilkan: Semua waktu';
  if (f.mode === 'month' && f.yearMonth) {
    const d = new Date(f.yearMonth + '-02');
    return 'Menampilkan: ' + d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
  if (f.mode === 'range') return `Menampilkan: ${formatDate(f.dateFrom)} — ${formatDate(f.dateTo)}`;
  return '';
}

function renderFinanceFilter() {
  const select = document.getElementById('finance-month-select');
  const now = new Date();
  const options = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const sel = state.finance.filter.yearMonth === ym ? 'selected' : '';
    options.push(`<option value="${escAttr(ym)}" ${sel}>${escHtml(label)}</option>`);
  }
  select.innerHTML = options.join('');
  document.getElementById('finance-period-label').textContent = periodLabel(state.finance.filter);
  if (state.finance.filter.dateFrom) document.getElementById('finance-date-from').value = state.finance.filter.dateFrom;
  if (state.finance.filter.dateTo) document.getElementById('finance-date-to').value = state.finance.filter.dateTo;
}

function renderFinanceCards() {
  const donors = state.finance.donors;
  const expenses = state.finance.expenses;
  const prev = state.finance.prevBalance;
  const masuk = donors.reduce((s, d) => s + Number(d.amount || 0), 0);
  const keluar = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const saldo = prev + masuk - keluar;

  document.getElementById('finance-cards').innerHTML = `
    <div class="admin-finance-formula">
      <div class="admin-finance-formula-item">
        <strong>${escHtml(formatRupiah(prev))}</strong>
        <span>Sisa Bulan Lalu</span>
      </div>
      <span class="admin-finance-op">+</span>
      <div class="admin-finance-formula-item">
        <strong>${escHtml(formatRupiah(masuk))}</strong>
        <span>Total Pemasukan</span>
      </div>
      <span class="admin-finance-op">&minus;</span>
      <div class="admin-finance-formula-item">
        <strong>${escHtml(formatRupiah(keluar))}</strong>
        <span>Total Pengeluaran</span>
      </div>
      <span class="admin-finance-op admin-finance-eq">=</span>
      <div class="admin-finance-formula-item admin-finance-result">
        <strong>${escHtml(formatRupiah(saldo))}</strong>
        <span>Saldo Akhir</span>
      </div>
    </div>
    <div class="admin-finance-summary">
      <div class="admin-finance-card finance-prev">
        <span>Sisa Bulan Lalu</span>
        <strong>${escHtml(formatRupiah(prev))}</strong>
      </div>
      <div class="admin-finance-card finance-in">
        <span>Total Pemasukan</span>
        <strong>${escHtml(formatRupiah(masuk))}</strong>
        <small>${donors.length} donasi</small>
      </div>
      <div class="admin-finance-card finance-out">
        <span>Total Pengeluaran</span>
        <strong>${escHtml(formatRupiah(keluar))}</strong>
        <small>${expenses.length} transaksi</small>
      </div>
      <div class="admin-finance-card finance-end">
        <span>Saldo Akhir Periode</span>
        <strong>${escHtml(formatRupiah(saldo))}</strong>
      </div>
    </div>
  `;
}

function renderFinanceDonors() {
  const donors = state.finance.donors;
  const total = donors.reduce((s, d) => s + Number(d.amount || 0), 0);
  document.getElementById('finance-donors-count').textContent = `${donors.length} donasi`;
  const rows = donors.map(d => `
    <tr>
      <td>${escHtml(formatDate(d.donation_date))}</td>
      <td>${escHtml(d.is_anonymous ? 'Hamba Allah' : d.name)}</td>
      <td>${escHtml(d.notes || '—')}</td>
      <td class="finance-amount-in">${escHtml(formatRupiah(d.amount))}</td>
    </tr>
  `).join('');
  const totalRow = `<tr class="admin-table-total"><td colspan="3">Total Pemasukan</td><td class="finance-amount-in">${escHtml(formatRupiah(total))}</td></tr>`;
  document.getElementById('finance-donors-body').innerHTML = rows
    ? rows + totalRow
    : emptyRow(4, 'Tidak ada pemasukan pada periode ini.');
}

function renderFinanceExpenses() {
  const expenses = state.finance.expenses;
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const rows = expenses.map(e => {
    const cat = e.expense_categories;
    const isRab = cat && cat.breakdown_id;
    const badge = cat
      ? `<span class="admin-cat-badge ${isRab ? 'rab' : 'custom'}">${escHtml(cat.name)}</span>`
      : '—';
    return `<tr>
      <td>${escHtml(formatDate(e.expense_date))}</td>
      <td>${badge}</td>
      <td>${escHtml(e.description)}</td>
      <td class="finance-amount-out">${escHtml(formatRupiah(e.amount))}</td>
      <td>${rowActions('expense', e.id)}</td>
    </tr>`;
  }).join('');
  const totalRow = `<tr class="admin-table-total"><td colspan="3">Total Pengeluaran</td><td class="finance-amount-out">${escHtml(formatRupiah(total))}</td><td></td></tr>`;
  document.getElementById('finance-expenses-body').innerHTML = rows
    ? rows + totalRow
    : emptyRow(5, 'Tidak ada pengeluaran pada periode ini.');
  bindRowActions();
}

function openCategoryManager() {
  state.modalType = 'expense-category';
  state.editingId = null;
  modalTitle.textContent = 'Kelola Kategori Pengeluaran';
  modalFields.innerHTML = categoryManagerHtml();
  bindCategoryManagerEvents();
  modal.showModal();
}

function categoryManagerHtml() {
  const rabCats = state.finance.categories.filter(c => c.breakdown_id);
  const customCats = state.finance.categories.filter(c => !c.breakdown_id);

  const rabRows = rabCats.map(c => `
    <div class="admin-cat-manager-item">
      <span class="admin-cat-badge rab">${escHtml(c.name)}</span>
      <span class="admin-muted">Dari RAB</span>
    </div>
  `).join('') || '<p class="admin-muted">Belum ada kategori dari RAB.</p>';

  const customRows = customCats.map(c => `
    <div class="admin-cat-manager-item">
      <span class="admin-cat-badge custom">${escHtml(c.name)}</span>
      <button type="button" class="admin-btn admin-btn-light" style="padding:4px 10px;font-size:11px" data-delete-cat="${escAttr(c.id)}">Hapus</button>
    </div>
  `).join('') || '<p class="admin-muted">Belum ada kategori kustom.</p>';

  return `
    <p class="admin-muted" style="margin-bottom:8px">Kategori dari RAB tidak dapat dihapus di sini.</p>
    <div class="admin-cat-manager-list">${rabRows}${customRows}</div>
    <hr style="margin:12px 0;border:none;border-top:1px dashed #e0e0e0" />
    <label>Nama Kategori Baru
      <input type="text" name="cat_name" placeholder="cth: Honorarium, Konsumsi tukang..." />
    </label>
  `;
}

function bindCategoryManagerEvents() {
  modalFields.querySelectorAll('[data-delete-cat]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Hapus kategori ini? Pastikan tidak ada pengeluaran yang menggunakannya.')) return;
      const { error } = await adminDb.from('expense_categories').delete().eq('id', btn.dataset.deleteCat);
      if (error) { showToast(error.message || 'Gagal menghapus kategori.', true); return; }
      await loadFinanceCategories();
      modalFields.innerHTML = categoryManagerHtml();
      bindCategoryManagerEvents();
      showToast('Kategori berhasil dihapus.');
    };
  });
}

async function handleCategoryAdd(form) {
  const name = clean(form.get('cat_name'));
  if (!name) { showToast('Nama kategori wajib diisi.', true); return; }
  const { error } = await adminDb.from('expense_categories').insert({ name, sort_order: 99 });
  if (error) { showToast(error.message || 'Gagal menambah kategori.', true); return; }
  await loadFinanceCategories();
  modalFields.innerHTML = categoryManagerHtml();
  bindCategoryManagerEvents();
  showToast('Kategori berhasil ditambah.');
}

function printFinanceReport() {
  const donors = state.finance.donors;
  const expenses = state.finance.expenses;
  const prev = state.finance.prevBalance;
  const masuk = donors.reduce((s, d) => s + Number(d.amount || 0), 0);
  const keluar = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const saldo = prev + masuk - keluar;
  const period = periodLabel(state.finance.filter).replace('Menampilkan: ', '');
  const majelisName = escHtml((state.settings || {}).majelis_name || 'Majelis');

  const donorRows = donors.map(d =>
    `<tr><td>${escHtml(formatDate(d.donation_date))}</td><td>${escHtml(d.is_anonymous ? 'Hamba Allah' : d.name)}</td><td>${escHtml(d.notes || '-')}</td><td style="text-align:right;color:#2e7d32">${escHtml(formatRupiah(d.amount))}</td></tr>`
  ).join('') || '<tr><td colspan="4" style="text-align:center;color:#aaa">Tidak ada pemasukan.</td></tr>';

  const expenseRows = expenses.map(e => {
    const cat = e.expense_categories;
    return `<tr><td>${escHtml(formatDate(e.expense_date))}</td><td>${escHtml(cat ? cat.name : '-')}</td><td>${escHtml(e.description)}</td><td style="text-align:right;color:#e65100">${escHtml(formatRupiah(e.amount))}</td></tr>`;
  }).join('') || '<tr><td colspan="4" style="text-align:center;color:#aaa">Tidak ada pengeluaran.</td></tr>';

  const html = [
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>',
    `<title>Laporan Keuangan ${escHtml(period)}</title>`,
    '<style>',
    'body{font-family:Arial,sans-serif;color:#222;font-size:13px;padding:24px}',
    'h1{color:#1a3a5c;font-size:20px;margin:0}.sub{color:#555;margin-top:4px}.meta{color:#999;font-size:11px;margin-top:2px}',
    '.header{text-align:center;border-bottom:2px solid #1a3a5c;padding-bottom:14px;margin-bottom:18px}',
    '.cards{display:flex;gap:10px;margin-bottom:18px}',
    '.card{flex:1;border-radius:6px;padding:10px;text-align:center}',
    '.card span{display:block;font-size:10px;text-transform:uppercase;color:#555;font-weight:700}',
    '.card strong{display:block;font-size:15px;font-weight:800;margin-top:3px}',
    '.c1{background:#f3e5f5}.c1 strong{color:#6a1b9a}',
    '.c2{background:#e8f4fe}.c2 strong{color:#1565c0}',
    '.c3{background:#fff3e0}.c3 strong{color:#e65100}',
    '.c4{background:#e8f5e9}.c4 strong{color:#2e7d32}',
    'h3{font-size:11px;text-transform:uppercase;color:#888;margin:14px 0 6px}',
    'table{width:100%;border-collapse:collapse;font-size:12px}',
    'th{background:#f7f8fa;text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;font-size:10px;font-weight:700;text-transform:uppercase;color:#888}',
    'td{padding:5px 8px;border-bottom:1px solid #eee}',
    'tfoot td{font-weight:700;background:#f7f8fa;border-top:2px solid #ddd}',
    '</style></head><body>',
    '<div class="header">',
    `<h1>${majelisName}</h1>`,
    `<p class="sub">Laporan Keuangan — ${escHtml(period)}</p>`,
    `<p class="meta">Dicetak: ${escHtml(formatDate(today()))}</p>`,
    '</div>',
    '<div class="cards">',
    `<div class="card c1"><span>Sisa Bulan Lalu</span><strong>${escHtml(formatRupiah(prev))}</strong></div>`,
    `<div class="card c2"><span>Total Pemasukan</span><strong>${escHtml(formatRupiah(masuk))}</strong></div>`,
    `<div class="card c3"><span>Total Pengeluaran</span><strong>${escHtml(formatRupiah(keluar))}</strong></div>`,
    `<div class="card c4"><span>Saldo Akhir</span><strong>${escHtml(formatRupiah(saldo))}</strong></div>`,
    '</div>',
    `<h3>Rincian Pemasukan (${donors.length} donasi)</h3>`,
    '<table><thead><tr><th>Tanggal</th><th>Donatur</th><th>Catatan</th><th style="text-align:right">Nominal</th></tr></thead>',
    `<tbody>${donorRows}</tbody>`,
    `<tfoot><tr><td colspan="3">Total</td><td style="text-align:right;color:#2e7d32">${escHtml(formatRupiah(masuk))}</td></tr></tfoot></table>`,
    `<h3>Rincian Pengeluaran (${expenses.length} transaksi)</h3>`,
    '<table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th style="text-align:right">Nominal</th></tr></thead>',
    `<tbody>${expenseRows}</tbody>`,
    `<tfoot><tr><td colspan="3">Total</td><td style="text-align:right;color:#e65100">${escHtml(formatRupiah(keluar))}</td></tr></tfoot></table>`,
    '</body></html>',
  ].join('');

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) { showToast('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini.', true); URL.revokeObjectURL(url); return; }
  win.addEventListener('load', function () {
    win.print();
    URL.revokeObjectURL(url);
  });
}

function exportFinanceCsv() {
  const f = state.finance.filter;
  const period = (f.mode === 'month' && f.yearMonth)
    ? f.yearMonth
    : (f.mode === 'range' ? `${f.dateFrom}_${f.dateTo}` : 'semua-waktu');

  const donorRows = [['Tanggal', 'Donatur', 'Catatan', 'Nominal']];
  state.finance.donors.forEach(d => {
    donorRows.push([d.donation_date, d.is_anonymous ? 'Hamba Allah' : d.name, d.notes || '', d.amount]);
  });
  downloadCsv(donorRows, `pemasukan-${period}.csv`);

  const expenseRows = [['Tanggal', 'Kategori', 'Keterangan', 'Nominal']];
  state.finance.expenses.forEach(e => {
    expenseRows.push([e.expense_date, e.expense_categories ? e.expense_categories.name : '', e.description, e.amount]);
  });
  downloadCsv(expenseRows, `pengeluaran-${period}.csv`);
}

function downloadCsv(rows, filename) {
  const bom = '﻿';
  const csv = bom + rows.map(row => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
