(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const searchToggle = $('.search-toggle');
  const searchPanel = $('#search-panel');
  const searchInput = $('#collection-search');
  const menuToggle = $('.menu-toggle');
  const menu = $('#mobile-nav');
  const cards = [...document.querySelectorAll('.product-card')];
  const dialog = $('#detail-dialog');
  let dialogTrigger = null;
  function setSearch(open, focus = true) {
    searchPanel.hidden = !open;
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open && focus) searchInput.focus();
  }
  searchToggle.addEventListener('click', () => setSearch(searchPanel.hidden));
  $('.collection-search-button').addEventListener('click', () => {
    setSearch(true, false);
    searchPanel.scrollIntoView({block: 'start'});
    searchInput.focus({preventScroll: true});
  });
  menuToggle.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    menu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open menu');
  }));
  function filterCards() {
    const terms = searchInput.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let matches = 0;
    cards.forEach(card => {
      const haystack = `${card.dataset.keywords} ${card.dataset.title} ${card.dataset.theme}`.toLocaleLowerCase();
      card.hidden = !terms.every(term => haystack.includes(term));
      if (!card.hidden) matches++;
    });
    $('#collection-count').textContent = String(matches).padStart(2, '0');
    $('#empty-results').hidden = matches !== 0;
    $('#search-status').textContent = terms.length ? `${matches} result${matches === 1 ? '' : 's'} found.` : '';
  }
  const initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) { searchInput.value = initialQuery; setSearch(true, false); filterCards(); }
  searchInput.addEventListener('input', filterCards);
  $('#search-form').addEventListener('submit', event => {
    event.preventDefault(); filterCards(); $('#collection').scrollIntoView({block:'start'});
  });
  $('#search-form').addEventListener('reset', () => setTimeout(filterCards, 0));
  $('.clear-search').addEventListener('click', () => { searchInput.value = ''; filterCards(); setSearch(true); });
  function updateCartCount() {
    let count = 0;
    try {
      const items = JSON.parse(localStorage.getItem('tpf_cart') || '[]');
      if (Array.isArray(items)) count = items.reduce((sum, item) => {
        const quantity = Number(item && item.qty);
        return sum + (Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0);
      }, 0);
    } catch { /* A blocked or malformed local cart should not break browsing. */ }
    $('#cart-count').textContent = count > 99 ? '99+' : String(count);
    $('.cart-link').setAttribute('aria-label', `Shopping cart, ${count} item${count === 1 ? '' : 's'}`);
  }
  function updateStockBadges() {
    cards.forEach(card => {
      const product = window.tpfShop?.product(card.dataset.productId);
      const badge = card.querySelector('.sold-out-badge');
      if (product && badge) {
        const comingSoon = product.status === 'coming-soon';
        badge.textContent = comingSoon ? 'Coming soon' : 'Sold out';
        badge.hidden = !comingSoon && product.quantityAvailable !== 0;
        card.querySelector('a.product-image')?.setAttribute('aria-label', `View ${card.dataset.title}, ${comingSoon ? 'coming soon' : badge.hidden ? (product.coinCount > 1 ? 'lot of ' + product.coinCount : 'sold individually') : 'sold out'}`);
        const photoLabel = card.querySelector('.real-photo-label');
        if (photoLabel) photoLabel.hidden = !badge.hidden;
      }
    });
  }
  window.tpfShop?.ready.then(updateStockBadges).catch(() => {});
  window.addEventListener('tpf:stock', updateStockBadges);
  window.addEventListener('tpf:cart', updateCartCount);
  updateCartCount();
  window.addEventListener('storage', updateCartCount);
  window.addEventListener('pageshow', updateCartCount);
  function showDialog(title, body, trigger, eyebrow = 'COLLECTION PREVIEW') {
    dialogTrigger = trigger;
    $('#dialog-title').textContent = title;
    $('#dialog-body').textContent = body;
    $('#dialog-eyebrow').textContent = eyebrow;
    $('#dialog-eyebrow').hidden = !eyebrow;
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    dialog.setAttribute('aria-describedby', 'dialog-body');
    dialog.showModal();
  }
  cards.forEach(card => card.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    showDialog(card.dataset.title, 'This is a preview of the coin collection layout. The artwork is illustrative.\n\nActual coin photos, identification, condition and pricing will be added before this item can be purchased.', button);
  })));
  $('.dialog-close').addEventListener('click', () => dialog.close());
  $('.dialog-dismiss').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialogTrigger?.focus());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.open) {
      if (!searchPanel.hidden) { setSearch(false); searchToggle.focus(); }
      if (!menu.hidden) { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Open menu'); }
    }
  });
  const policies = {
    "Shipping & returns": "Shipping within Canada only. Shipping is included where stated in the item listing; it is included for our current coin listings.\n\nDispatch: Orders are dispatched within 3 business days after payment, unless a delay is posted on the website. Delivery times vary by destination and shipping service. Tracking is provided when included with the service used.\n\nChange-of-mind returns: Contact us within 14 days of delivery to arrange a return. Items must be returned in the same condition, with all included packaging and accessories. The buyer pays return postage.\n\nWrong, damaged or misdescribed items: Email us promptly with your order details and photos. We cover necessary return postage and arrange a refund or a suitable replacement.\n\nRefunds: After receiving and checking a return, we refund the purchase price to the original payment method. Your payment provider may take additional time to show the refund.\n\nCancellations: Contact us before dispatch and we will try to cancel your order.\n\nContact: leblancri@rogers.com. This policy does not limit your statutory consumer rights.",
    "Privacy": "We use the contact and delivery information provided with your order to process payment, fulfil and ship your order, and provide customer service. Order and transaction records are retained as needed for administration and applicable legal requirements.\n\nPayments are processed by Stripe. Full card details are entered through Stripe’s checkout, rather than collected through this website. Delivery information is shared with the shipping provider as needed to deliver your order.\n\nContact enquiries are sent through your email app. We use your email address and message to reply and resolve your enquiry. Please do not send payment card details or other sensitive information by email.\n\nWe use anonymous aggregate counters to measure page views, clicks on coin listings and traffic from registered advertisement links. Counts are grouped by hour, page and ad source. These analytics do not use cookies, visitor identifiers or fingerprinting, and do not store IP addresses, full referring URLs or individual browsing histories. Page views include repeat loads; they are not unique visitor counts. Known automated traffic and browser Do Not Track or Global Privacy Control signals are excluded where detectable. You can turn counting off for this browser using the analytics preference link. That optional preference stores only an on/off setting in your browser. Our hosting providers also process technical connection information to deliver and secure the website.\n\nYour shopping cart is saved in your browser’s local storage so it can remain available between visits. You can remove it by clearing this website’s stored browser data.\n\nFor privacy questions or requests about your personal information, contact leblancri@rogers.com.",
    "Terms": "Top Pocket Find sells collectibles from New Brunswick, Canada. Prices are in Canadian dollars. Any applicable taxes and shipping charges are shown before you pay; shipping is included where stated in the listing.\n\nRead the item description and review the photos before ordering. Condition, quantity and included packaging or accessories are specified in each listing. Items are sold individually unless the listing states otherwise. A coin’s face value is its denomination, not its selling price.\n\nStock is limited. Adding an item to your cart does not reserve it; availability is checked again at checkout. Payments are processed securely through Stripe.\n\nOur Shipping & returns policy explains dispatch, cancellations, returns and refunds. These terms do not limit your statutory consumer rights.\n\nQuestions about an item or an order? Contact leblancri@rogers.com."
};
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => showDialog(button.dataset.policy, policies[button.dataset.policy], button, '')));
  $('#copyright-year').textContent = String(new Date().getFullYear());
})();
