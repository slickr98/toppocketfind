(() => {
  'use strict';
  const shop = window.tpfShop;
  const $ = selector => document.querySelector(selector);
  let busy = false;
  function node(tag, text, className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  }
  function render() {
    const items = shop.get();
    $('#list').replaceChildren();
    $('#empty').style.display = items.length ? 'none' : 'block';
    $('#list').style.display = items.length ? 'grid' : 'none';
    for (const item of items) {
      const row = node('div', undefined, 'item');
      const details = node('div');
      details.append(node('div', item.title, 'title'), node('div', `${shop.money(item.priceCents)} each`, 'muted'));
      const controls = node('div', undefined, 'qty');
      const dec = node('button', '−'); dec.type = 'button'; dec.setAttribute('aria-label', `Decrease quantity of ${item.title}`);
      const inc = node('button', '+'); inc.type = 'button'; inc.setAttribute('aria-label', `Increase quantity of ${item.title}`);
      inc.disabled = item.qty >= item.maxQty;
      const remove = node('button', 'Remove', 'remove-btn'); remove.type = 'button';
      const change = qty => { try { shop.setQuantity(item.id, qty); } catch { $('#cart-status').textContent = 'Unable to save your cart. Please allow browser storage.'; } };
      dec.addEventListener('click', () => change(item.qty - 1));
      inc.addEventListener('click', () => change(item.qty + 1));
      remove.addEventListener('click', () => change(0));
      controls.append(dec, node('span', String(item.qty)), inc, remove);
      details.append(controls); row.append(details, node('strong', shop.money(item.priceCents * item.qty)));
      $('#list').append(row);
    }
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
    $('#subtotal').textContent = shop.money(subtotal);
    $('#shipping').textContent = items.length ? 'Included' : shop.money(0);
    $('#total').textContent = shop.money(subtotal);
    $('#checkout').disabled = busy || !items.length || !shop.checkoutReady();
    $('#checkout').textContent = busy ? 'Opening secure checkout…' : 'Checkout';
    $('#cart-status').textContent = !items.length ? '' : shop.checkoutReady() ? 'Shipping included within Canada. Stock is confirmed at checkout.' : 'Checkout is being prepared. Your items can stay in your cart.';
  }
  $('#clear').addEventListener('click', () => { try { shop.save([]); } catch { $('#cart-status').textContent = 'Unable to clear your cart.'; } });
  $('#checkout').addEventListener('click', async () => {
    if (busy) return;
    busy = true; render();
    try {
      await shop.refreshStock();
      const items = shop.get();
      if (!items.length || !shop.checkoutReady()) throw new Error('Checkout is currently unavailable. Your items can stay in your cart.');
      const response = await fetch(`${shop.api}/create-checkout-session`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({items: items.map(item => ({id: item.id, qty: item.qty}))})
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout. Please try again.');
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Unable to open secure checkout.');
      window.location.assign(url.href);
    } catch (error) {
      busy = false; render(); $('#cart-status').textContent = error.message;
    }
  });
  window.addEventListener('tpf:cart', render);
  window.addEventListener('tpf:stock', render);
  shop.ready.then(render).catch(error => { $('#cart-status').textContent = error.message; });
})();
