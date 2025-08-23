// cart/cart.js
(() => {
  'use strict';

  const KEY = 'tpf_cart_v1';
  const SHIP_BASE = 9.99;   // base shipping
  const SHIP_PER  = 3.00;   // each additional item

  const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const write = (c) => localStorage.setItem(KEY, JSON.stringify(c));

  const api = {
    get:   () => read(),
    save:  (c) => { write(c); api.updateCount(); },

    add: (item) => {
      const c = read();
      // prevent duplicates of one-off items
      if (!c.find(x => x.id === item.id)) c.push(item);
      api.save(c);
      return c.length;
    },

    remove: (id) => {
      const c = read().filter(x => x.id !== id);
      api.save(c);
    },

    clear: () => { api.save([]); },

    totals: () => {
      const items = read();
      const subtotal = items.reduce((s, x) => s + Number(x.price || 0), 0);
      const shipping = items.length ? SHIP_BASE + Math.max(0, items.length - 1) * SHIP_PER : 0;
      const total = +(subtotal + shipping).toFixed(2);
      return {
        items,
        subtotal: +subtotal.toFixed(2),
        shipping: +shipping.toFixed(2),
        total
      };
    },

    // UI helpers
    updateCount: (id = 'cartCount') => {
      const el = document.getElementById(id);
      if (el) el.textContent = read().length;
    },
    fmt: (n) => `$${Number(n).toFixed(2)} CAD`
  };

  // expose
  window.tpfCart = api;

  // auto-update count on every page that loads this file
  document.addEventListener('DOMContentLoaded', () => api.updateCount());
})();