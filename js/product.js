(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
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
  function cartCount() {
    let count = 0;
    try {
      const items = JSON.parse(localStorage.getItem('tpf_cart') || '[]');
      if (Array.isArray(items)) count = items.reduce((sum, item) => {
        const qty = Number(item && item.qty);
        return sum + (Number.isSafeInteger(qty) && qty > 0 ? qty : 0);
      }, 0);
    } catch { /* Browsing still works when local storage is unavailable. */ }
    $('#cart-count').textContent = count > 99 ? '99+' : String(count);
    $('.cart-link').setAttribute('aria-label', `Shopping cart, ${count} item${count === 1 ? '' : 's'}`);
  }
  cartCount(); window.addEventListener('pageshow', cartCount); window.addEventListener('storage', cartCount); window.addEventListener('tpf:cart', cartCount);
  const thumbs = [...document.querySelectorAll('.thumbnail-button')];
  const lightbox = $('#photo-lightbox');
  let selected = 0;
  function selectPhoto(index) {
    selected = (index + thumbs.length) % thumbs.length;
    const thumb = thumbs[selected];
    // SVG viewports reframe original photo pixels without altering coin detail.
    for (const id of ['#main-photo', '#lightbox-photo']) {
      const frame = $(id);
      frame.setAttribute('viewBox', thumb.dataset.viewbox);
      const crop = thumb.dataset.viewbox.split(' ');
      const bounds = frame.querySelector('clipPath rect');
      ['x', 'y', 'width', 'height'].forEach((name, i) => bounds.setAttribute(name, crop[i]));
      frame.setAttribute('aria-label', thumb.dataset.caption);
      const source = frame.querySelector('image');
      source.setAttribute('href', thumb.dataset.full);
      source.setAttribute('width', thumb.dataset.width);
      source.setAttribute('height', thumb.dataset.height);
      source.setAttribute('transform', thumb.dataset.transform);
    }
    $('#photo-caption').textContent = thumb.dataset.caption;
    $('#photo-counter').textContent = `${selected + 1} / ${thumbs.length}`;
    $('#lightbox-caption').textContent = thumb.dataset.caption;
    $('#lightbox-counter').textContent = `Photo ${selected + 1} of ${thumbs.length}`;
    $('#full-photo-link').href = thumb.dataset.full;
    thumbs.forEach((button,i) => button.setAttribute('aria-pressed', String(i === selected)));
  }
  thumbs.forEach((thumb,i) => thumb.addEventListener('click', () => selectPhoto(i)));
  $('#open-photo').addEventListener('click', () => lightbox.showModal());
  $('#close-photo').addEventListener('click', () => lightbox.close());
  $('#previous-photo').addEventListener('click', () => selectPhoto(selected - 1));
  $('#next-photo').addEventListener('click', () => selectPhoto(selected + 1));
  lightbox.addEventListener('close', () => $('#open-photo').focus());
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); selectPhoto(selected + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectPhoto(selected - 1); }
  });
  lightbox.addEventListener('click', event => {
    if (event.target !== lightbox) return;
    const r = lightbox.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) lightbox.close();
  });
  const policyDialog = $('#policy-dialog');
  let policyTrigger;
  const policies = {
    'Shipping & returns':'Shipping is included in the $54.95 CAD price per coin, within Canada only. Full return terms will be available before checkout opens.',
    'Privacy': 'Contact messages (name, email and message) are sent to Rick through FormSubmit, which retains submissions for 30 days. The shopping cart is stored in your browser, and payments are processed by Stripe. Please do not send card details or sensitive personal information through the contact form. The full privacy policy is being finalized.',
    'Terms':'The price is $54.95 CAD for one coin with its presentation packaging and accompanying Mint paperwork. Coins are sold individually, subject to remaining stock. Full sales terms will be available before checkout opens.'
  };
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => {
    policyTrigger = button;
    $('#policy-title').textContent = button.dataset.policy;
    $('#policy-body').textContent = policies[button.dataset.policy];
    policyDialog.showModal();
  }));
  document.querySelectorAll('[data-close-policy]').forEach(button => button.addEventListener('click', () => policyDialog.close()));
  policyDialog.addEventListener('close', () => policyTrigger?.focus());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !lightbox.open && !policyDialog.open) {
      searchPanel.hidden = true; searchToggle.setAttribute('aria-expanded','false');
      menu.hidden = true; menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','Open menu');
    }
  });
  const quantity = $('#coin-quantity');
  const addButton = $('#add-to-cart');
  function updatePurchaseControls() {
    const product = window.tpfShop.product('coin-001');
    if (!product) return;
    const stock = product.quantityAvailable;
    const inBag = window.tpfShop.get().find(item => item.id === product.id)?.qty || 0;
    const remaining = Math.max(0, stock - inBag);
    $('#stock-status').textContent = stock ? `${stock} available${inBag ? ` · ${inBag} in your cart` : ''}` : 'Sold out';
    quantity.max = String(remaining);
    quantity.disabled = remaining === 0;
    quantity.hidden = stock === 0;
    $('label[for="coin-quantity"]').hidden = stock === 0;
    if (remaining) quantity.value = String(Math.min(remaining, Math.max(1, Number(quantity.value) || 1)));
    addButton.disabled = remaining === 0;
    addButton.textContent = !stock ? 'Sold out' : remaining ? 'Add to cart' : 'All available coins are in your cart';
  }
  window.tpfShop.ready.then(updatePurchaseControls).catch(error => {
    addButton.textContent = 'Unable to load item'; $('#cart-feedback').textContent = error.message;
  });
  window.addEventListener('tpf:cart', updatePurchaseControls);
  window.addEventListener('tpf:stock', updatePurchaseControls);
  addButton.addEventListener('click', () => {
    try {
      if (!quantity.checkValidity()) { quantity.reportValidity(); return; }
      window.tpfShop.add('coin-001', Number(quantity.value));
      $('#cart-feedback').replaceChildren(document.createTextNode('Added to your cart. '));
      const link = document.createElement('a'); link.href = '../cart/cart.html'; link.textContent = 'View cart';
      $('#cart-feedback').append(link);
    } catch (error) {
      $('#cart-feedback').textContent = error.name === 'QuotaExceededError' || error.name === 'SecurityError' ? 'Please allow browser storage to use the shopping cart.' : error.message;
    }
  });
  selectPhoto(0);
  $('#copyright-year').textContent = String(new Date().getFullYear());
})();
