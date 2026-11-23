/* Anonymous aggregate counters. No cookies, visitor IDs or fingerprinting. */
(() => {
  'use strict';
  const API = 'https://tpf-api.onrender.com/analytics/collect';
  const EXCLUDE = 'tpf_analytics_exclude';
  const sources = new Set(['kijiji', 'facebook', 'google', 'bing', 'other']);
  const incoming = new URLSearchParams(location.search);
  try {
    if (incoming.get('analytics') === 'off') localStorage.setItem(EXCLUDE, '1');
    if (incoming.get('analytics') === 'on') localStorage.removeItem(EXCLUDE);
    if (localStorage.getItem(EXCLUDE) === '1') return;
  } catch { if (incoming.get('analytics') === 'off') return; }
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  if (location.pathname.startsWith('/track')) return;
  let campaign = '';
  let source = incoming.get('utm_source');
  if (!sources.has(source)) {
    source = 'direct';
    try {
      const host = new URL(document.referrer).hostname;
      if (host === location.hostname || ['www.toppocketfind.ca', 'toppocketfind.ca'].includes(host)) source = 'direct';
      else if (/(^|\.)kijiji\.ca$/.test(host)) source = 'kijiji';
      else if (/(^|\.)facebook\.com$/.test(host)) source = 'facebook';
      else if (/(^|\.)google\.[a-z.]+$/.test(host)) source = 'google';
      else if (/(^|\.)bing\.com$/.test(host)) source = 'bing';
      else source = 'other';
    } catch { /* No referrer means direct / unknown. */ }
  }
  let active = false;
  function send(event, page) {
    if (!active) return;
    // A fixed path and registered campaign only: no raw query/referrer is sent.
    const body = JSON.stringify({event, page, source, campaign});
    fetch(API, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body,
      credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true}).catch(() => {});
  }
  const currentPath = location.pathname === '/index.html' ? '/' : location.pathname;
  const productPath = path => /^\/products\/[a-z0-9-]+\.html$/.test(path);
  const storePath = path => path === '/' || path === '/index.html' || path === '/cart/cart.html' || productPath(path);
  fetch('/api/tracking-campaigns.json', {credentials: 'omit', referrerPolicy: 'no-referrer'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .then(config => {
      const requested = incoming.get('utm_campaign');
      if (config.campaigns?.some(row => row.source === source && row.id === requested)) campaign = requested;
      active = true;
      send('page_view', currentPath);
    }).catch(() => { /* Counting never blocks shopping. */ });
  function prepareLink(event) {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || !active) return;
    let destination;
    try { destination = new URL(anchor.href, location.href); } catch { return; }
    if (destination.origin !== location.origin || !storePath(destination.pathname)) return;
    // Carry shared ad labels between pages without identifying the visitor.
    if (source !== 'direct') {
      destination.searchParams.set('utm_source', source);
      if (campaign) destination.searchParams.set('utm_campaign', campaign);
      else destination.searchParams.delete('utm_campaign');
      anchor.href = destination.href;
    }
    if (productPath(destination.pathname)) send('product_click', destination.pathname);
  }
  document.addEventListener('click', prepareLink);
  document.addEventListener('auxclick', event => {if (event.button === 1) prepareLink(event);});
  window.addEventListener('pageshow', event => {if (event.persisted) send('page_view', currentPath);});
})();
