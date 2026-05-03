/* Shared helpers for public and admin pages. */

function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#039;');
}

function escSafeClass(str) {
  return String(str ?? '').replace(/[^a-z0-9_-]/gi, '');
}

function escAttrUrl(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

let sharedToastTimer;
function showToast(message, isError = false, className = '') {
  const toastClass = className || (document.body.classList.contains('admin-body') ? 'admin-toast' : 'toast');
  let toast = document.querySelector(`.${toastClass}`);
  if (!toast) {
    toast = document.createElement('div');
    toast.className = toastClass;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(sharedToastTimer);
  sharedToastTimer = setTimeout(() => toast.classList.remove('show'), toastClass === 'admin-toast' ? 2600 : 2200);
}
