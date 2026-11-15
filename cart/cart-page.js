(() => {
  'use strict';
  const shop = window.tpfShop;
  const $ = selector => document.querySelector(selector);
  let busy = false;
  function node(tag, text, className) {
    const el = document.createElement(tag); if (text !== undefined) el.textContent = text;
    if (className) el.className = className; return el;
  }
  const searchToggle = $('.search-toggle');
  const searchPanel = $('#search-panel');
  const menuToggle = $('.menu-toggle');
  const menu = $('#mobile-nav');
  searchToggle.addEventListener('click', () => {
    const open = searchPanel.hidden;
    searchPanel.hidden = !open;
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) $('#collection-search').focus();
  });
  menuToggle.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!searchPanel.hidden) { searchPanel.hidden = true; searchToggle.setAttribute('aria-expanded', 'false'); searchToggle.focus(); }
    if (!menu.hidden) { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Open menu'); menuToggle.focus(); }
  });
  $('#copyright-year').textContent = String(new Date().getFullYear());
  function thumbnail(product) {
    const photo = product?.images?.[0];
    if (!photo?.src) return null;
    const ns = 'http://www.w3.org/2000/svg';
    const frame = document.createElementNS(ns, 'svg');
    frame.setAttribute('role', 'img');
    frame.setAttribute('aria-label', photo.alt || product.title);
    frame.setAttribute('viewBox', Array.isArray(photo.viewBox) ? photo.viewBox.join(' ') : `0 0 ${photo.sourceWidth} ${photo.sourceHeight}`);
    frame.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const image = document.createElementNS(ns, 'image');
    image.setAttribute('href', '/' + photo.src.replace(/^\//, ''));
    image.setAttribute('width', String(photo.sourceWidth));
    image.setAttribute('height', String(photo.sourceHeight));
    image.setAttribute('transform', photo.transform || '');
    frame.append(image);
    const link = node('a', undefined, 'cart-item-image');
    link.href = '/' + product.url.replace(/^\//, '');
    link.setAttribute('aria-label', `View ${product.title}`);
    link.append(frame);
    return link;
  }
  function render() {
    const focusedControl = document.activeElement?.closest('.cart-item button')?.getAttribute('aria-label');
    const items = shop.get();
    $('#list').replaceChildren();
    $('#empty').hidden = !!items.length;
    $('#list').hidden = !items.length;
    $('#cart-utilities').hidden = !items.length;
    const count = items.reduce((total, item) => total + item.qty, 0);
    $('#item-count').textContent = `${count} item${count === 1 ? '' : 's'}`;
    $('#cart-count').textContent = count > 99 ? '99+' : String(count);
    $('.cart-link').setAttribute('aria-label', `Shopping cart, ${count} item${count === 1 ? '' : 's'}`);
    for (const item of items) {
      const row = node('article', undefined, 'cart-item');
      const product = shop.product(item.id);
      const photo = thumbnail(product);
      if (photo) row.append(photo);
      const details = node('div', undefined, 'cart-item-details');
      if (product?.mint) details.append(node('p', `${product.mint.toUpperCase()}${product.year ? ' · ' + product.year : ''}`, 'item-category'));
      const title = node('h3');
      if (product?.url) { const link = node('a', item.title); link.href = '/' + product.url.replace(/^\//, ''); title.append(link); }
      else title.textContent = item.title;
      details.append(title, node('p', `${shop.money(item.priceCents)} each`, 'unit-price'));
      const controls = node('div', undefined, 'qty');
      const dec = node('button', '−'); dec.type = 'button'; dec.setAttribute('aria-label', `Decrease quantity of ${item.title}`);
      const inc = node('button', '+'); inc.type = 'button'; inc.setAttribute('aria-label', `Increase quantity of ${item.title}`);
      inc.disabled = item.qty >= item.maxQty;
      const remove = node('button', 'Remove', 'remove-btn'); remove.type = 'button';
      const change = qty => { try { shop.setQuantity(item.id, qty); } catch { $('#cart-status').textContent = 'Unable to save your cart. Please allow browser storage.'; } };
      dec.addEventListener('click', () => change(item.qty - 1));
      inc.addEventListener('click', () => change(item.qty + 1));
      remove.setAttribute('aria-label', `Remove ${item.title}`);
      remove.addEventListener('click', () => change(0));
      controls.append(dec, node('span', String(item.qty)), inc, remove);
      details.append(controls); row.append(details, node('strong', shop.money(item.priceCents * item.qty), 'line-total'));
      $('#list').append(row);
    }
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
    const stock = shop.stockStatus();
    $('#subtotal').textContent = shop.money(subtotal);
    $('#shipping').textContent = items.length ? 'Included' : shop.money(0);
    $('#total').textContent = shop.money(subtotal);
    $('#checkout').disabled = busy || !items.length || !shop.checkoutReady();
    $('#checkout').textContent = busy ? 'Opening secure checkout…' : stock.checking ? 'Checking availability…' : stock.paymentMode === 'test' && shop.checkoutReady() ? 'Test checkout' : 'Checkout';
    $('#test-checkout-note').hidden = !(stock.paymentMode === 'test' && shop.checkoutReady());
    $('#retry-stock').hidden = !items.length || !stock.failed || stock.checking;
    $('#cart-status').textContent = !items.length ? '' : stock.checking ? 'Checking availability. Please wait; this can take up to a minute.' : stock.failed ? 'Unable to confirm availability. Your items are saved; please try again.' : shop.checkoutReady() ? 'Stock is confirmed again at checkout.' : 'Checkout is being prepared. Your items can stay in your cart.';
    if (focusedControl) {
      const replacement = [...$('#list').querySelectorAll('button')].find(button => button.getAttribute('aria-label') === focusedControl && !button.disabled);
      (replacement || $('#list button:not(:disabled)') || $('#empty .button')).focus({preventScroll: true});
    }
  }
  $('#retry-stock').addEventListener('click', () => shop.refreshStock());
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
        signal: AbortSignal.timeout(90000),
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
