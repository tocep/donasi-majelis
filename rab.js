/* ===================================================
   Donasi Majelis Nuruzh Zholam - RAB Detail Page
   Konten dari DB di-escape via escHtml() sebelum render.
   =================================================== */

const rabDb = createSupabaseClient();
document.addEventListener('DOMContentLoaded', loadRabData);

async function loadRabData() {
  if (!rabDb) {
    const td = document.createElement('td');
    td.colSpan = 5; td.className = 'rab-empty';
    td.textContent = 'Konfigurasi Supabase belum diisi.';
    const tr = document.createElement('tr'); tr.appendChild(td);
    document.getElementById('rab-tbody').replaceChildren(tr);
    return;
  }
  try {
    const [bdRes, itemsRes, donorsRes] = await Promise.all([
      rabDb.from('fund_breakdown').select('*').order('sort_order', { ascending: true }),
      rabDb.from('fund_breakdown_items').select('*').order('sort_order', { ascending: true }),
      rabDb.from('donors').select('amount'),
    ]);
    if (bdRes.error) throw bdRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (donorsRes.error) throw donorsRes.error;

    const breakdown = bdRes.data || [];
    const allItems  = itemsRes.data || [];
    const donors    = donorsRes.data || [];

    const terkumpul = donors.reduce((s, d) => s + Number(d.amount || 0), 0);

    const itemsByParent = {};
    allItems.forEach(item => {
      if (!itemsByParent[item.breakdown_id]) itemsByParent[item.breakdown_id] = [];
      itemsByParent[item.breakdown_id].push(item);
    });

    const totalRab = breakdown.reduce((s, b) => {
      const subs = itemsByParent[b.id] || [];
      const rab  = subs.length > 0
        ? subs.reduce((ss, si) => ss + Number(si.amount || 0), 0)
        : Number(b.amount || 0);
      return s + rab;
    }, 0);
    const sisa = Math.max(totalRab - terkumpul, 0);

    const terealisasi = breakdown.reduce((s, b) => {
      const subs = itemsByParent[b.id] || [];
      const real = subs.length > 0
        ? subs.reduce((ss, si) => ss + Number(si.realization_amount || 0), 0)
        : Number(b.realization_amount || 0);
      return s + real;
    }, 0);

    renderRabCards(totalRab, terkumpul, sisa, terealisasi);
    renderRabProgress(totalRab, terkumpul, terealisasi);
    renderRabTable(breakdown, itemsByParent, totalRab, terealisasi);
  } catch (err) {
    const td = document.createElement('td');
    td.colSpan = 5; td.className = 'rab-empty';
    td.textContent = err.message || 'Gagal memuat data.';
    const tr = document.createElement('tr'); tr.appendChild(td);
    document.getElementById('rab-tbody').replaceChildren(tr);
  }
}

function renderRabCards(totalRab, terkumpul, sisa, terealisasi) {
  const pct = totalRab > 0 ? Math.round((terkumpul / totalRab) * 100) : 0;
  const el = document.getElementById('rab-cards');
  el.querySelector('.card-total .rab-card-value').textContent     = formatRupiah(totalRab);
  el.querySelector('.card-total .rab-card-note').textContent      = 'Total kebutuhan anggaran';
  el.querySelector('.card-terkumpul .rab-card-value').textContent = formatRupiah(terkumpul);
  el.querySelector('.card-terkumpul .rab-card-note').textContent  = pct + '% dari total RAB';
  el.querySelector('.card-sisa .rab-card-value').textContent      = formatRupiah(sisa);
  el.querySelector('.card-sisa .rab-card-note').textContent       = 'RAB - Terkumpul';
  el.querySelector('.card-realisasi .rab-card-value').textContent = formatRupiah(terealisasi);
  el.querySelector('.card-realisasi .rab-card-note').textContent  = 'Dana sudah dibelanjakan';
}

function renderRabProgress(totalRab, terkumpul, terealisasi) {
  const pctT = totalRab > 0 ? Math.min(Math.round((terkumpul   / totalRab) * 100), 100) : 0;
  const pctR = totalRab > 0 ? Math.min(Math.round((terealisasi / totalRab) * 100), 100) : 0;
  document.getElementById('rab-progress').replaceChildren(
    makeProgRow('Terkumpul',   '#1d4ed8', pctT, terkumpul,   totalRab, 'rab-prog-fill-blue'),
    makeProgRow('Terealisasi', '#059669', pctR, terealisasi, totalRab, 'rab-prog-fill-green')
  );
}

function makeProgRow(label, color, pct, val, total, fillClass) {
  const row = document.createElement('div'); row.className = 'rab-prog-row';
  const lbl = document.createElement('div'); lbl.className = 'rab-prog-label';
  const lSpan = document.createElement('span');
  lSpan.style.cssText = 'color:' + color + ';font-weight:600';
  lSpan.textContent = String.fromCodePoint(0x25CF) + ' ' + label;
  const rSpan = document.createElement('span');
  rSpan.style.cssText = 'font-weight:600;color:#374151';
  rSpan.textContent = pct + '%  (' + formatRupiah(val) + ' / ' + formatRupiah(total) + ')';
  lbl.appendChild(lSpan); lbl.appendChild(rSpan);
  const bar = document.createElement('div'); bar.className = 'rab-prog-bar';
  const fill = document.createElement('div'); fill.className = fillClass; fill.style.width = pct + '%';
  bar.appendChild(fill);
  row.appendChild(lbl); row.appendChild(bar);
  return row;
}

function makeBadge(pct, real) {
  const badge = document.createElement('span');
  if (pct === 100) { badge.className = 'rab-badge-lunas'; badge.textContent = 'Lunas'; }
  else if (real > 0) { badge.className = 'rab-badge-berjalan'; badge.textContent = 'Berjalan'; }
  else { badge.className = 'rab-badge-belum'; badge.textContent = 'Belum'; }
  return badge;
}

function makeMiniBar(pct, fillClass) {
  const wrap = document.createElement('div'); wrap.className = 'rab-mini-bar-wrap';
  const bar  = document.createElement('div'); bar.className  = 'rab-mini-bar';
  const fill = document.createElement('div'); fill.className = fillClass; fill.style.width = pct + '%';
  bar.appendChild(fill);
  const pctSpan = document.createElement('span'); pctSpan.className = 'rab-pct'; pctSpan.textContent = pct + '%';
  wrap.appendChild(bar); wrap.appendChild(pctSpan);
  return wrap;
}

function makeAmtTd(val, positiveClass) {
  const td = document.createElement('td');
  if (val > 0) { td.className = positiveClass; td.textContent = formatRupiah(val); }
  else { td.className = 'rab-amt-zero'; td.textContent = '-'; }
  return td;
}

function renderRabTable(breakdown, itemsByParent, totalRab, totalReal) {
  const tbody = document.getElementById('rab-tbody');
  if (breakdown.length === 0) {
    const td = document.createElement('td');
    td.colSpan = 5; td.className = 'rab-empty'; td.textContent = 'RAB belum diisi panitia.';
    const tr = document.createElement('tr'); tr.appendChild(td);
    tbody.replaceChildren(tr);
    return;
  }

  const rows = [];
  breakdown.forEach(pos => {
    const gid      = 'g-' + escSafeClass(pos.id);
    const children = itemsByParent[pos.id] || [];
    const rab = children.length > 0
      ? children.reduce((s, c) => s + Number(c.amount || 0), 0)
      : Number(pos.amount || 0);
    const real = children.length > 0
      ? children.reduce((s, c) => s + Number(c.realization_amount || 0), 0)
      : Number(pos.realization_amount || 0);
    const sisa = Math.max(rab - real, 0);
    const pct  = rab > 0 ? Math.min(Math.round((real / rab) * 100), 100) : 0;
    const fillCls = pct === 100 ? 'rab-mini-fill-green' : 'rab-mini-fill-blue';

    const trParent = document.createElement('tr');
    trParent.className = 'rab-row-parent';
    trParent.dataset.group = gid;

    const tdLabel = document.createElement('td');
    if (children.length > 0) {
      const icon = document.createElement('span');
      icon.className = 'rab-toggle'; icon.textContent = String.fromCodePoint(0x25BA);
      tdLabel.appendChild(icon);
      trParent.addEventListener('click', () => rabToggle(trParent, gid));
    } else {
      const spacer = document.createElement('span');
      spacer.style.cssText = 'display:inline-block;width:20px';
      tdLabel.appendChild(spacer);
    }
    const labelSpan = document.createElement('span'); labelSpan.textContent = pos.label;
    tdLabel.appendChild(labelSpan);
    tdLabel.appendChild(makeBadge(pct, real));

    const tdRab = document.createElement('td'); tdRab.textContent = formatRupiah(rab);
    const tdProg = document.createElement('td'); tdProg.appendChild(makeMiniBar(pct, fillCls));

    trParent.appendChild(tdLabel); trParent.appendChild(tdRab);
    trParent.appendChild(makeAmtTd(real, 'rab-amt-real'));
    trParent.appendChild(makeAmtTd(sisa, 'rab-amt-sisa'));
    trParent.appendChild(tdProg);
    rows.push(trParent);

    children.forEach(item => {
      const ir = Number(item.amount || 0);
      const iv = Number(item.realization_amount || 0);
      const is = Math.max(ir - iv, 0);
      const ip = ir > 0 ? Math.min(Math.round((iv / ir) * 100), 100) : 0;
      const ifc = ip === 100 ? 'rab-mini-fill-green' : 'rab-mini-fill-blue';

      const trChild = document.createElement('tr');
      trChild.className = 'rab-row-child hidden';
      trChild.dataset.parent = gid;

      const tdIL = document.createElement('td'); tdIL.textContent = item.label;
      const tdIR = document.createElement('td'); tdIR.textContent = formatRupiah(ir);
      const tdIP = document.createElement('td'); tdIP.appendChild(makeMiniBar(ip, ifc));

      trChild.appendChild(tdIL); trChild.appendChild(tdIR);
      trChild.appendChild(makeAmtTd(iv, 'rab-amt-real'));
      trChild.appendChild(makeAmtTd(is, 'rab-amt-sisa'));
      trChild.appendChild(tdIP);
      rows.push(trChild);
    });
  });

  const totalSisa = Math.max(totalRab - totalReal, 0);
  const totalPct  = totalRab > 0 ? Math.round((totalReal / totalRab) * 100) : 0;
  const trTotal = document.createElement('tr'); trTotal.className = 'rab-row-total';
  [
    ['TOTAL KESELURUHAN', ''],
    [formatRupiah(totalRab), ''],
    [formatRupiah(totalReal), 'color:#059669'],
    [formatRupiah(totalSisa), 'color:#d97706'],
    [totalPct + '% terealisasi', 'text-align:right;font-size:12px'],
  ].forEach(([text, style]) => {
    const td = document.createElement('td');
    td.textContent = text;
    if (style) td.style.cssText = style;
    trTotal.appendChild(td);
  });
  rows.push(trTotal);
  tbody.replaceChildren(...rows);
}

function rabToggle(row, gid) {
  row.classList.toggle('open');
  document.querySelectorAll('[data-parent="' + gid + '"]').forEach(r => r.classList.toggle('hidden'));
}
