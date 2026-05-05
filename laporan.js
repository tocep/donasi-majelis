const reportDb = createSupabaseClient();

document.addEventListener('DOMContentLoaded', loadReportData);

function calcTotalRabLaporan(breakdown, items) {
  const byParent = {};
  items.forEach(i => {
    if (!byParent[i.breakdown_id]) byParent[i.breakdown_id] = [];
    byParent[i.breakdown_id].push(i);
  });
  return breakdown.reduce((s, b) => {
    const subs = byParent[b.id] || [];
    return s + (subs.length > 0
      ? subs.reduce((ss, si) => ss + Number(si.amount || 0), 0)
      : Number(b.amount || 0));
  }, 0);
}

async function loadReportData() {
  const summary = document.getElementById('laporan-summary');
  if (!reportDb) {
    summary.textContent = 'Konfigurasi Supabase belum diisi.';
    return;
  }

  try {
    const [settingsRes, donorsRes, breakdownRes, breakdownItemsRes] = await Promise.all([
      reportDb.from('site_settings').select('*').eq('id', 1).single(),
      reportDb.from('donors').select('*').order('donation_date', { ascending: false }),
      reportDb.from('fund_breakdown').select('*').order('sort_order', { ascending: true }),
      reportDb.from('fund_breakdown_items').select('id,breakdown_id,amount'),
    ]);
    const failed = [settingsRes, donorsRes, breakdownRes, breakdownItemsRes].find(res => res.error);
    if (failed) throw failed.error;

    const settings = settingsRes.data || {};
    const donors = donorsRes.data || [];
    const breakdown = breakdownRes.data || [];
    const total = donors.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const target = calcTotalRabLaporan(breakdown, breakdownItemsRes.data || []);
    const used = Number(settings.funds_used || 0);

    summary.textContent = `Update ${settings.report_date || '-'} - ${donors.length} donatur tercatat.`;
    renderReportFunds(total, target, used);
    renderReportBreakdown(breakdown);
    renderMonthlyChart(donors);
    renderReportDonors(donors);
  } catch (error) {
    summary.textContent = error.message || 'Laporan belum dapat dimuat.';
  }
}

function renderReportFunds(total, target, used) {
  const values = [
    ['Dana Masuk', formatRupiah(total)],
    ['Dana Terpakai', formatRupiah(used)],
    ['Saldo', formatRupiah(Math.max(total - used, 0))],
    ['Target', formatRupiah(target)],
  ];
  document.getElementById('laporan-fund-grid').innerHTML = values.map(([label, value]) => `
    <div class="fund-card fund-primary"><span>${escHtml(label)}</span><strong>${escHtml(value)}</strong></div>
  `).join('');
}

function renderReportBreakdown(items) {
  const wrap = document.getElementById('laporan-breakdown');
  wrap.innerHTML = items.map(item => `
    <div class="fund-breakdown-row">
      <span>${escHtml(item.label)}</span>
      <strong>${formatRupiah(item.amount)}</strong>
    </div>
  `).join('') || '<p class="transparency-note">Rincian RAB belum tersedia.</p>';
}

function renderReportDonors(donors) {
  document.getElementById('laporan-table-body').innerHTML = donors.map(item => `
    <tr>
      <td>${escHtml(item.is_anonymous ? 'Hamba Allah' : item.name)}</td>
      <td>${escHtml(formatRupiah(item.amount))}</td>
      <td>${escHtml(item.donation_date || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="admin-empty">Belum ada data donatur.</td></tr>';
}

function renderMonthlyChart(donors) {
  const canvas = document.getElementById('monthly-chart');
  const ctx = canvas.getContext('2d');
  const monthly = new Map();
  donors.forEach(item => {
    const key = String(item.donation_date || '').slice(0, 7) || 'Tanpa tanggal';
    monthly.set(key, (monthly.get(key) || 0) + Number(item.amount || 0));
  });
  const rows = [...monthly.entries()].sort();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e293b';
  ctx.font = '18px Inter, sans-serif';
  if (rows.length === 0) {
    ctx.fillText('Belum ada data donasi bulanan.', 24, 48);
    return;
  }
  const max = Math.max(...rows.map(([, value]) => value), 1);
  const barWidth = Math.max(36, (canvas.width - 80) / rows.length - 14);
  rows.forEach(([label, value], index) => {
    const height = Math.round((value / max) * 220);
    const x = 42 + index * (barWidth + 14);
    const y = 260 - height;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x, y, barWidth, height);
    ctx.fillStyle = '#475569';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(label, x, 288);
  });
}
