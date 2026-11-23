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
    if (!thumbs.length) return;
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
  $('#open-photo')?.addEventListener('click', () => lightbox.showModal());
  $('#close-photo')?.addEventListener('click', () => lightbox.close());
  $('#previous-photo')?.addEventListener('click', () => selectPhoto(selected - 1));
  $('#next-photo')?.addEventListener('click', () => selectPhoto(selected + 1));
  lightbox?.addEventListener('close', () => $('#open-photo')?.focus());
  lightbox?.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); selectPhoto(selected + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); selectPhoto(selected - 1); }
  });
  lightbox?.addEventListener('click', event => {
    if (event.target !== lightbox) return;
    const r = lightbox.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) lightbox.close();
  });
  const policyDialog = $('#policy-dialog');
  let policyTrigger;
  const policies = {
    "Shipping & returns": "Shipping within Canada only. Shipping is included where stated in the item listing; it is included for our current coin listings.\n\nDispatch: Orders are dispatched within 3 business days after payment, unless a delay is posted on the website. Delivery times vary by destination and shipping service. Tracking is provided when included with the service used.\n\nChange-of-mind returns: Contact us within 14 days of delivery to arrange a return. Items must be returned in the same condition, with all included packaging and accessories. The buyer pays return postage.\n\nWrong, damaged or misdescribed items: Email us promptly with your order details and photos. We cover necessary return postage and arrange a refund or a suitable replacement.\n\nRefunds: After receiving and checking a return, we refund the purchase price to the original payment method. Your payment provider may take additional time to show the refund.\n\nCancellations: Contact us before dispatch and we will try to cancel your order.\n\nContact: leblancri@rogers.com. This policy does not limit your statutory consumer rights.",
    "Privacy": "We use the contact and delivery information provided with your order to process payment, fulfil and ship your order, and provide customer service. Order and transaction records are retained as needed for administration and applicable legal requirements.\n\nPayments are processed by Stripe. Full card details are entered through Stripe’s checkout, rather than collected through this website. Delivery information is shared with the shipping provider as needed to deliver your order.\n\nContact enquiries are sent through your email app. We use your email address and message to reply and resolve your enquiry. Please do not send payment card details or other sensitive information by email.\n\nWe use anonymous aggregate counters to measure page views, clicks on coin listings and traffic from registered advertisement links. Counts are grouped by hour, page and ad source. These analytics do not use cookies, visitor identifiers or fingerprinting, and do not store IP addresses, full referring URLs or individual browsing histories. Page views include repeat loads; they are not unique visitor counts. Known automated traffic and browser Do Not Track or Global Privacy Control signals are excluded where detectable. You can turn counting off for this browser using the analytics preference link. That optional preference stores only an on/off setting in your browser. Our hosting providers also process technical connection information to deliver and secure the website.\n\nYour shopping cart is saved in your browser’s local storage so it can remain available between visits. You can remove it by clearing this website’s stored browser data.\n\nFor privacy questions or requests about your personal information, contact leblancri@rogers.com.",
    "Terms": "Top Pocket Find sells collectibles from New Brunswick, Canada. Prices are in Canadian dollars. Any applicable taxes and shipping charges are shown before you pay; shipping is included where stated in the listing.\n\nRead the item description and review the photos before ordering. Condition, quantity and included packaging or accessories are specified in each listing. Items are sold individually unless the listing states otherwise. A coin’s face value is its denomination, not its selling price.\n\nStock is limited. Adding an item to your cart does not reserve it; availability is checked again at checkout. Payments are processed securely through Stripe.\n\nOur Shipping & returns policy explains dispatch, cancellations, returns and refunds. These terms do not limit your statutory consumer rights.\n\nQuestions about an item or an order? Contact leblancri@rogers.com."
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
    if (event.key === 'Escape' && !lightbox?.open && !policyDialog.open) {
      searchPanel.hidden = true; searchToggle.setAttribute('aria-expanded','false');
      menu.hidden = true; menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','Open menu');
    }
  });
  const productId = document.body.dataset.productId || 'coin-001';
  const quantity = $('#coin-quantity');
  const addButton = $('#add-to-cart');
  function updatePurchaseControls() {
    const product = window.tpfShop.product(productId);
    if (!product) return;
    const comingSoon = product.status === 'coming-soon';
    const stock = product.purchasable === false || comingSoon ? 0 : product.quantityAvailable;
    const inBag = window.tpfShop.get().find(item => item.id === product.id)?.qty || 0;
    const remaining = Math.max(0, stock - inBag);
    $('#stock-status').textContent = comingSoon ? 'Coming soon' : stock ? `${stock} available${inBag ? ` · ${inBag} in your cart` : ''}` : 'Sold out';
    quantity.max = String(remaining);
    quantity.disabled = remaining === 0;
    quantity.hidden = stock === 0;
    $('label[for="coin-quantity"]').hidden = stock === 0;
    if (remaining) quantity.value = String(Math.min(remaining, Math.max(1, Number(quantity.value) || 1)));
    addButton.disabled = remaining === 0;
    addButton.textContent = comingSoon ? 'Coming soon' : !stock ? 'Sold out' : remaining ? 'Add to cart' : product.coinCount > 1 ? 'This lot is already in your cart' : 'All available coins are in your cart';
  }
  window.tpfShop.ready.then(updatePurchaseControls).catch(error => {
    addButton.textContent = 'Unable to load item'; $('#cart-feedback').textContent = error.message;
  });
  window.addEventListener('tpf:cart', updatePurchaseControls);
  window.addEventListener('tpf:stock', updatePurchaseControls);
  addButton.addEventListener('click', () => {
    try {
      if (!quantity.checkValidity()) { quantity.reportValidity(); return; }
      window.tpfShop.add(productId, Number(quantity.value));
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
