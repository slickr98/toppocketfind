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
    $('.cart-link').setAttribute('aria-label', `Shopping bag, ${count} item${count === 1 ? '' : 's'}`);
  }
  cartCount(); window.addEventListener('pageshow', cartCount); window.addEventListener('storage', cartCount);
  const thumbs = [...document.querySelectorAll('.thumbnail-button')];
  const lightbox = $('#photo-lightbox');
  let selected = 0;
  function selectPhoto(index) {
    selected = (index + thumbs.length) % thumbs.length;
    const thumb = thumbs[selected];
    $('#main-photo').src = thumb.dataset.full;
    $('#main-photo').alt = thumb.dataset.caption;
    $('#photo-caption').textContent = thumb.dataset.caption;
    $('#photo-counter').textContent = `${selected + 1} / ${thumbs.length}`;
    $('#lightbox-photo').src = thumb.dataset.full;
    $('#lightbox-photo').alt = thumb.dataset.caption;
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
    'Shipping & returns':'We will ship within Canada. Postage, packaging and return terms for this lot will be confirmed before purchasing is enabled.',
    'Privacy':'The photo gallery and product page do not submit contact information. The existing shopping bag is stored in your browser. Our full privacy policy will be available before orders open.',
    'Terms':'This lot is listed for review while its price is being prepared. It cannot be added to the shopping bag or purchased yet. Full sales terms will be available before orders open.'
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
  selectPhoto(0);
  $('#copyright-year').textContent = String(new Date().getFullYear());
})();
