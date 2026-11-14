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
    $('#search-status').textContent = terms.length ? `${matches} collection preview${matches === 1 ? '' : 's'} found.` : '';
  }
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
    $('.cart-link').setAttribute('aria-label', `Shopping bag, ${count} item${count === 1 ? '' : 's'}`);
  }
  updateCartCount();
  window.addEventListener('storage', updateCartCount);
  window.addEventListener('pageshow', updateCartCount);
  function showDialog(title, body, trigger, eyebrow = 'COLLECTION PREVIEW') {
    dialogTrigger = trigger;
    $('#dialog-title').textContent = title;
    $('#dialog-body').textContent = body;
    $('#dialog-eyebrow').textContent = eyebrow;
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
    'Shipping & returns': 'Our first collection will ship within Canada. Shipping options, rates and return terms are still being prepared and will be shown before orders open. This design preview does not accept purchases.',
    'Privacy': 'This homepage preview does not submit contact messages or install analytics. The existing shopping bag is stored in your browser. Our full privacy policy will be available before launch.',
    'Terms': 'This is a storefront design preview. The coin artwork and collection cards are illustrative, with no final product descriptions or prices. Purchases are not available from these preview cards. Full terms will be provided before launch.'
  };
  document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => showDialog(button.dataset.policy, policies[button.dataset.policy], button, 'BEFORE THE SHOP OPENS')));
  $('#contact-form').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const message = String(data.get('message') || '').trim();
    if (!name || !message) { $('#contact-status').textContent = 'Please add your name and message.'; return; }
    showDialog('Your message preview', `From: ${name}\nEmail: ${data.get('email')}\n\n${message}\n\nPreview only. Your message has not been sent or stored.`, event.submitter, 'CONTACT TOP POCKET FIND');
    $('#contact-status').textContent = 'Message preview opened. Nothing was sent.';
  });
  $('#copyright-year').textContent = String(new Date().getFullYear());
})();
