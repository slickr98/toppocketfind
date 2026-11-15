/* Shared cart and current stock for individually sold coins. */
(() => {
  'use strict';
  const KEY = 'tpf_cart';
  const API = 'https://tpf-api.onrender.com';
  let catalog = new Map();
  let checkoutReady = false;
  const money = cents => (cents / 100).toLocaleString('en-CA', {style: 'currency', currency: 'CAD'});
  const integer = (value, fallback = 0) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
  function read() {
    try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function normalize(items) {
    const merged = new Map();
    for (const raw of items) {
      if (!raw || typeof raw.id !== 'string') continue;
      const product = catalog.get(raw.id);
      const maxQty = product ? product.quantityAvailable : Math.max(1, integer(raw.maxQty, 1));
      const qty = Math.min(maxQty, integer(raw.qty));
      if (!qty) continue;
      const item = product ? {id: product.id, title: product.title, priceCents: product.priceCents,
        image: '/' + (product.images?.[0]?.src || ''), qty, maxQty, shippingIncluded: product.shippingIncluded} :
        {...raw, qty, maxQty, priceCents: integer(raw.priceCents)};
      const previous = merged.get(item.id);
      if (previous) previous.qty = Math.min(maxQty, previous.qty + qty);
      else merged.set(item.id, item);
    }
    return [...merged.values()];
  }
  function save(items) {
    const normalized = normalize(items);
    localStorage.setItem(KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event('tpf:cart'));
    return normalized;
  }
  function get() { return normalize(read()); }
  function add(id, qty) {
    const product = catalog.get(id);
    if (!product || !Number.isSafeInteger(qty) || qty < 1) throw new Error('Choose a whole-number quantity.');
    const items = get();
    const existing = items.find(item => item.id === id);
    if ((existing?.qty || 0) + qty > product.quantityAvailable) throw new Error(`Only ${product.quantityAvailable} available, including any already in your cart.`);
    items.push({id, qty});
    return save(items);
  }
  function setQuantity(id, qty) {
    const items = get();
    const item = items.find(row => row.id === id);
    if (item) item.qty = Math.min(item.maxQty, Math.max(0, integer(qty)));
    return save(items.filter(row => row.qty > 0));
  }
  async function refreshStock() {
    try {
      const response = await fetch(`${API}/inventory`, {cache: 'no-store', signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error('Stock service unavailable');
      const data = await response.json();
      for (const product of data.products || []) {
        const known = catalog.get(product.id);
        if (known && Number.isSafeInteger(product.quantityAvailable) && product.quantityAvailable >= 0) {
          catalog.set(product.id, {...known, quantityAvailable: product.quantityAvailable});
        }
      }
      checkoutReady = data.checkoutReady === true;
    } catch { checkoutReady = false; }
    // Never overwrite someone's cart from another tab with a cached copy.
    try { save(read()); } catch { /* Browsing works when storage is unavailable. */ }
    window.dispatchEvent(new Event('tpf:stock'));
  }
  const ready = fetch('/api/coins.json', {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error('Unable to load coin details. Please refresh.');
    return response.json();
  }).then(data => {
    catalog = new Map(data.products.map(product => [product.id, product]));
    try { save(read()); } catch { /* Report storage errors when adding to the bag. */ }
    refreshStock();
  });
  window.tpfShop = {get, save, add, setQuantity, money, ready, refreshStock,
    product: id => catalog.get(id), checkoutReady: () => checkoutReady, api: API};
  window.addEventListener('storage', event => { if (event.key === KEY) window.dispatchEvent(new Event('tpf:cart')); });
  window.addEventListener('pageshow', () => ready.then(refreshStock).catch(() => {}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ready.then(refreshStock).catch(() => {}); });
  setInterval(() => { if (!document.hidden) ready.then(refreshStock).catch(() => {}); }, 30000);
})();
