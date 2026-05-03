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
