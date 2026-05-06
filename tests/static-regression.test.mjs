import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('public and admin pages load shared utils before page scripts', () => {
  const index = read('index.html');
  const admin = read('admin.html');

  assert.match(index, /<script src="utils\.js"><\/script>\s*<script src="script\.js"><\/script>/);
  assert.match(admin, /<script src="utils\.js\?v=\d+"><\/script>\s*<script src="admin\.js\?v=\d+"><\/script>/);
});

test('public page has WhatsApp preview metadata, share affordance, and FAQ section', () => {
  const index = read('index.html');

  assert.match(index, /property="og:image"/);
  assert.match(index, /property="og:url"/);
  assert.match(index, /id="share-whatsapp"/);
  assert.match(index, /id="faq"/);
});

test('admin gallery keeps image URLs intact and uploads reject oversized images', () => {
  const adminJs = read('admin.js');

  assert.match(adminJs, /<img src="\$\{escHtml\(item\.image_url\)\}" alt="\$\{escHtml\(item\.caption\)\}"/);
  assert.match(adminJs, /file\.size > 3 \* 1024 \* 1024/);
});

test('admin donors include search, pagination, and CSV export controls', () => {
  const adminHtml = read('admin.html');
  const adminJs = read('admin.js');

  assert.match(adminHtml, /id="donor-search"/);
  assert.match(adminHtml, /id="export-donors-csv"/);
  assert.match(adminHtml, /id="donor-pagination"/);
  assert.match(adminJs, /\.ilike\('name'/);
  assert.match(adminJs, /\.range\(offset, offset \+ DONORS_PAGE_SIZE - 1\)/);
  assert.match(adminJs, /function exportDonorsCsv\(\)/);
});

test('public script supports anonymous donors, optimized gallery URLs, realtime updates, and WhatsApp sharing', () => {
  const script = read('script.js');

  assert.match(script, /isAnonim:\s*Boolean\(item\.is_anonymous\)/);
  assert.match(script, /d\.isAnonim \? 'Hamba Allah'/);
  assert.match(script, /galleryImageUrl\(item\.src\)/);
  assert.match(script, /db\.channel\('donors-realtime'\)/);
  assert.match(script, /function initWhatsAppShare\(\)/);
});

test('admin dashboard validates access through admin_users table', () => {
  const adminJs = read('admin.js');
  const config = read('supabase-config.js');
  const schema = read('docs/planning/supabase-schema.sql');

  assert.doesNotMatch(config, /allowedAdminEmails/);
  assert.match(adminJs, /\.from\('admin_users'\)/);
  assert.match(adminJs, /Akun ini tidak memiliki akses admin\./);
  assert.match(schema, /create table if not exists public\.admin_users/);
  assert.match(schema, /where user_id = \(select auth\.uid\(\)\)/);
});

test('public donation confirmation submits pending confirmations with proof upload', () => {
  const index = read('index.html');
  const confirmation = read('konfirmasi.html');
  const script = read('script.js');
  const schema = read('docs/planning/supabase-schema.sql');

  assert.match(index, /href="konfirmasi\.html"/);
  assert.doesNotMatch(index, /id="confirmation-form"/);
  assert.match(confirmation, /id="confirmation-form"/);
  assert.match(confirmation, /id="confirmation-proof"/);
  assert.match(confirmation, /<script src="utils\.js"><\/script>\s*<script src="script\.js"><\/script>/);
  assert.match(script, /function initConfirmationForm\(\)/);
  assert.match(script, /\.from\('pending_confirmations'\)\.insert/);
  assert.match(script, /uploadPublicProof\(file\)/);
  assert.match(schema, /Public can upload confirmation proofs/);
});

test('public navigation only lists standalone pages consistently', () => {
  const script = read('script.js');
  const publicPages = ['index.html', 'konfirmasi.html', 'rab.html', 'laporan.html'];
  const expectedLinks = [
    ['Beranda', 'index.html'],
    ['RAB', 'rab.html'],
    ['Konfirmasi', 'konfirmasi.html'],
    ['Laporan', 'laporan.html'],
  ];

  for (const page of publicPages) {
    const html = read(page);
    const nav = html.match(/<nav class="nav-menu" id="nav-menu">([\s\S]*?)<\/nav>/)?.[1] ?? '';
    const links = [...nav.matchAll(/<a href="([^"]+)" class="nav-link(?: active-link)?">([^<]+)<\/a>/g)]
      .map(match => [match[2], match[1]]);

    assert.deepEqual(links, expectedLinks, `${page} should use the standard public page menu`);
    assert.doesNotMatch(nav, /href="[^"]*#/);
  }

  assert.match(script, /hashNavLinks/);
  assert.match(read('style.css'), /\.nav-link\.active-link/);
});

test('donation notes link to confirmation form and committee WhatsApp', () => {
  const index = read('index.html');
  const script = read('script.js');

  assert.doesNotMatch(index, /konfirmasi ke panitia via WhatsApp agar tercatat sebagai donatur/);
  assert.match(script, /function initDonationNotes\(\)/);
  assert.match(script, /form konfirmasi/);
  assert.match(script, /href="konfirmasi\.html"/);
  assert.match(script, /WhatsApp panitia/);
  assert.match(script, /https:\/\/wa\.me\/\$\{encodeURIComponent\(phone\)\}/);
});

test('fund breakdown is loaded, rendered publicly, and managed in admin', () => {
  const index = read('index.html');
  const admin = read('admin.html');
  const script = read('script.js');
  const adminJs = read('admin.js');

  assert.match(index, /id="fund-breakdown"/);
  assert.match(admin, /data-admin-tab="breakdown"/);
  assert.match(admin, /id="breakdown-body"/);
  assert.match(script, /\.from\('fund_breakdown'\)/);
  assert.match(script, /function renderFundBreakdown\(\)/);
  assert.match(adminJs, /function renderBreakdown\(\)/);
  assert.match(adminJs, /breakdown:\s*'fund_breakdown'/);
});

test('payment methods support verified_at badges', () => {
  const script = read('script.js');
  const adminJs = read('admin.js');

  assert.match(script, /terverifikasiPada:\s*item\.verified_at/);
  assert.match(script, /Diverifikasi panitia per/);
  assert.match(adminJs, /verified_at/);
  assert.match(adminJs, /Tanggal Verifikasi/);
});

test('admin includes pending confirmations, audit logs, and bulk donor import', () => {
  const admin = read('admin.html');
  const adminJs = read('admin.js');

  assert.match(admin, /data-admin-tab="confirmations"/);
  assert.match(admin, /id="confirmations-body"/);
  assert.match(admin, /id="import-donors-csv"/);
  assert.match(adminJs, /function renderConfirmations\(\)/);
  assert.match(adminJs, /function verifyConfirmation/);
  assert.match(adminJs, /function rejectConfirmation/);
  assert.match(adminJs, /function logAdminAction/);
  assert.match(adminJs, /\.from\('admin_logs'\)\.insert/);
  assert.match(adminJs, /function importDonorsCsv/);
});

test('PWA shell and public report page are present', () => {
  const index = read('index.html');
  const manifest = read('manifest.json');
  const sw = read('sw.js');
  const laporan = read('laporan.html');

  assert.match(index, /rel="manifest" href="manifest\.json"/);
  assert.match(index, /serviceWorker\.register\('sw\.js'\)/);
  assert.match(manifest, /Majelis Nuruzh Zholam/);
  assert.match(sw, /CACHE_NAME/);
  assert.match(laporan, /id="laporan-table-body"/);
  assert.match(laporan, /laporan\.js/);
});
