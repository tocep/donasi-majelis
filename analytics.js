(function () {
  const config = window.DONASI_ANALYTICS;

  if (!config || config.enabled !== true || !config.endpoint) {
    return;
  }

  const payload = {
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer || '',
    timestamp: new Date().toISOString(),
  };

  if (navigator.sendBeacon) {
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(config.endpoint, body);
    return;
  }

  fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(function () {
    // Analytics must never interrupt the donation page.
  });
})();
