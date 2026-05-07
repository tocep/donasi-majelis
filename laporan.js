const pubDb = createSupabaseClient();

const state = {
  filter: { mode: 'month', yearMonth: '', dateFrom: null, dateTo: null },
  donors: [],
  expenses: [],
  prevBalance: 0,
};

document.addEventListener('DOMContentLoaded', () => {
  initMonthSelect();
  bindEvents();
  loadAndRender();
});

function initMonthSelect() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  state.filter.yearMonth = ym;
  const select = document.getElementById('pub-month-select');
  const options = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const sel = val === ym ? 'selected' : '';
    options.push('<option value="' + escAttr(val) + '" ' + sel + '>' + escHtml(label) + '</option>');
  }
  select.innerHTML = options.join('');
}

function bindEvents() {
  document.getElementById('pub-month-select').addEventListener('change', function(e) {
    state.filter.mode = 'month';
    state.filter.yearMonth = e.target.value;
    loadAndRender();
  });
  document.getElementById('pub-apply-btn').addEventListener('click', function() {
    const from = document.getElementById('pub-date-from').value;
    const to = document.getElementById('pub-date-to').value;
    if (!from || !to) { showToast('Isi kedua tanggal untuk rentang kustom.', true); return; }
    if (from > to) { showToast('Tanggal mulai tidak boleh setelah tanggal selesai.', true); return; }
    state.filter.mode = 'custom';
    state.filter.dateFrom = from;
    state.filter.dateTo = to;
    loadAndRender();
  });
  document.getElementById('pub-all-btn').addEventListener('click', function() {
    state.filter.mode = 'all';
    loadAndRender();
  });
}

async function loadAndRender() {
  if (!pubDb) { showToast('Konfigurasi Supabase belum diisi.', true); return; }
  document.getElementById('pub-period-label').textContent = periodLabel();
  try {
    const f = state.filter;
    let dateFrom = null;
    let dateTo = null;

    if (f.mode === 'month' && f.yearMonth) {
      const parts = f.yearMonth.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      dateFrom = f.yearMonth + '-01';
      const lastDay = new Date(y, m, 0).getDate();
      dateTo = f.yearMonth + '-' + String(lastDay).padStart(2, '0');
    } else if (f.mode === 'custom') {
      dateFrom = f.dateFrom;
      dateTo = f.dateTo;
    }

    let donorQ = pubDb.from('donors').select('*').order('donation_date', { ascending: false });
    let expenseQ = pubDb
      .from('expenses')
      .select('*, expense_categories(id, name, breakdown_id)')
      .order('expense_date', { ascending: false });

    if (dateFrom) {
      donorQ = donorQ.gte('donation_date', dateFrom);
      expenseQ = expenseQ.gte('expense_date', dateFrom);
    }
    if (dateTo) {
      donorQ = donorQ.lte('donation_date', dateTo);
      expenseQ = expenseQ.lte('expense_date', dateTo);
    }

    let prevBalance = 0;
    if (f.mode !== 'all' && dateFrom) {
      const [py, pm, pd] = dateFrom.split('-').map(Number);
      const prevLocal = new Date(py, pm - 1, pd - 1);
      const prevTo = prevLocal.getFullYear() + '-'
        + String(prevLocal.getMonth() + 1).padStart(2, '0') + '-'
        + String(prevLocal.getDate()).padStart(2, '0');
      const results = await Promise.all([
        pubDb.from('donors').select('amount').lte('donation_date', prevTo),
        pubDb.from('expenses').select('amount').lte('expense_date', prevTo),
      ]);
      const prevDonorRes = results[0];
      const prevExpRes = results[1];
      const prevDonors = (prevDonorRes.data || []).reduce(function(s, d) { return s + Number(d.amount || 0); }, 0);
      const prevExp = (prevExpRes.data || []).reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
      prevBalance = prevDonors - prevExp;
    }

    const all = await Promise.all([donorQ, expenseQ]);
    const donorRes = all[0];
    const expenseRes = all[1];
    if (donorRes.error) throw donorRes.error;
    if (expenseRes.error) throw expenseRes.error;

    state.donors = donorRes.data || [];
    state.expenses = expenseRes.data || [];
    state.prevBalance = prevBalance;

    renderCards();
    renderDonors();
    renderExpenses();
  } catch (err) {
    showToast((err && err.message) || 'Gagal memuat laporan.', true);
  }
}

function periodLabel() {
  const f = state.filter;
  if (f.mode === 'all') return 'Menampilkan: Semua waktu';
  if (f.mode === 'month' && f.yearMonth) {
    const d = new Date(f.yearMonth + '-02');
    return 'Menampilkan: ' + d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
  if (f.mode === 'custom') return 'Menampilkan: ' + formatDate(f.dateFrom) + ' - ' + formatDate(f.dateTo);
  return 'Memuat laporan...';
}

function renderCards() {
  const masuk = state.donors.reduce(function(s, d) { return s + Number(d.amount || 0); }, 0);
  const keluar = state.expenses.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
  const prev = state.prevBalance;
  const saldo = prev + masuk - keluar;

  const prevLabel = state.filter.mode === 'all' ? 'Saldo Awal' : 'Sisa Bulan Lalu';
  const formulaHtml =
    '<div class="admin-finance-formula">' +
      '<div class="admin-finance-formula-item">' +
        '<strong>' + escHtml(formatRupiah(prev)) + '</strong>' +
        '<span>' + escHtml(prevLabel) + '</span>' +
      '</div>' +
      '<span class="admin-finance-op">+</span>' +
      '<div class="admin-finance-formula-item">' +
        '<strong>' + escHtml(formatRupiah(masuk)) + '</strong>' +
        '<span>Total Pemasukan</span>' +
      '</div>' +
      '<span class="admin-finance-op">&minus;</span>' +
      '<div class="admin-finance-formula-item">' +
        '<strong>' + escHtml(formatRupiah(keluar)) + '</strong>' +
        '<span>Total Pengeluaran</span>' +
      '</div>' +
      '<span class="admin-finance-op admin-finance-eq">=</span>' +
      '<div class="admin-finance-formula-item admin-finance-result">' +
        '<strong>' + escHtml(formatRupiah(saldo)) + '</strong>' +
        '<span>Saldo Akhir</span>' +
      '</div>' +
    '</div>';

  const summaryHtml =
    '<div class="admin-finance-summary">' +
      '<div class="admin-finance-card finance-prev">' +
        '<span>' + escHtml(prevLabel) + '</span>' +
        '<strong>' + escHtml(formatRupiah(prev)) + '</strong>' +
      '</div>' +
      '<div class="admin-finance-card finance-in">' +
        '<span>Total Pemasukan</span>' +
        '<strong>' + escHtml(formatRupiah(masuk)) + '</strong>' +
        '<small>' + state.donors.length + ' donasi</small>' +
      '</div>' +
      '<div class="admin-finance-card finance-out">' +
        '<span>Total Pengeluaran</span>' +
        '<strong>' + escHtml(formatRupiah(keluar)) + '</strong>' +
        '<small>' + state.expenses.length + ' transaksi</small>' +
      '</div>' +
      '<div class="admin-finance-card finance-end">' +
        '<span>Saldo Akhir Periode</span>' +
        '<strong>' + escHtml(formatRupiah(saldo)) + '</strong>' +
      '</div>' +
    '</div>';

  document.getElementById('pub-cards').innerHTML = formulaHtml + summaryHtml;
}

function renderDonors() {
  const donors = state.donors;
  const total = donors.reduce(function(s, d) { return s + Number(d.amount || 0); }, 0);
  document.getElementById('pub-donors-count').textContent = donors.length + ' donasi';

  const rows = donors.map(function(d) {
    return '<tr>' +
      '<td>' + escHtml(formatDate(d.donation_date)) + '</td>' +
      '<td>' + escHtml(d.is_anonymous ? 'Hamba Allah' : d.name) + '</td>' +
      '<td>' + escHtml(d.notes || '-') + '</td>' +
      '<td class="finance-amount-in">' + escHtml(formatRupiah(d.amount)) + '</td>' +
      '</tr>';
  }).join('');

  const totalRow = '<tr class="admin-table-total">' +
    '<td colspan="3">Total Pemasukan</td>' +
    '<td class="finance-amount-in">' + escHtml(formatRupiah(total)) + '</td>' +
    '</tr>';

  document.getElementById('pub-donors-body').innerHTML = rows
    ? rows + totalRow
    : '<tr><td colspan="4" class="admin-empty">Tidak ada pemasukan pada periode ini.</td></tr>';
}

function renderExpenses() {
  const expenses = state.expenses;
  const total = expenses.reduce(function(s, e) { return s + Number(e.amount || 0); }, 0);
  document.getElementById('pub-expenses-count').textContent = expenses.length + ' transaksi';

  const rows = expenses.map(function(e) {
    const cat = e.expense_categories;
    const isRab = cat && cat.breakdown_id;
    const badge = cat
      ? '<span class="admin-cat-badge ' + (isRab ? 'rab' : 'custom') + '">' + escHtml(cat.name) + '</span>'
      : '-';
    return '<tr>' +
      '<td>' + escHtml(formatDate(e.expense_date)) + '</td>' +
      '<td>' + badge + '</td>' +
      '<td>' + escHtml(e.description) + '</td>' +
      '<td class="finance-amount-out">' + escHtml(formatRupiah(e.amount)) + '</td>' +
      '</tr>';
  }).join('');

  const totalRow = '<tr class="admin-table-total">' +
    '<td colspan="3">Total Pengeluaran</td>' +
    '<td class="finance-amount-out">' + escHtml(formatRupiah(total)) + '</td>' +
    '</tr>';

  document.getElementById('pub-expenses-body').innerHTML = rows
    ? rows + totalRow
    : '<tr><td colspan="4" class="admin-empty">Tidak ada pengeluaran pada periode ini.</td></tr>';
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date + 'T12:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
