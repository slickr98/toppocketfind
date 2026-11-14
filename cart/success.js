(async () => {
  const title = document.getElementById('confirmation-title');
  const status = document.getElementById('confirmation-status');
  const session = new URLSearchParams(location.search).get('session_id');
  if (!session) { title.textContent = 'Order confirmation'; status.textContent = 'No checkout reference was provided. Your shopping bag has not been changed.'; return; }
  try {
    const response = await fetch(`https://tpf-api.onrender.com/checkout-status?session_id=${encodeURIComponent(session)}`, {cache: 'no-store'});
    const data = await response.json();
    if (!response.ok || !data.paid) throw new Error(data.error || 'Payment has not yet been confirmed. You can refresh this page in a moment.');
    title.textContent = 'Thank you!';
    status.textContent = 'Your payment is confirmed and your order has been received.';
    // Clear only the purchased quantities, once. Never change inventory in the browser.
    try {
      const marker = `tpf_confirmed_${session}`;
      if (!localStorage.getItem(marker)) {
        const cart = JSON.parse(localStorage.getItem('tpf_cart') || '[]');
        if (Array.isArray(cart)) {
          for (const line of data.items) {
            const item = cart.find(row => row.id === line.id);
            if (item) item.qty = Math.max(0, item.qty - line.qty);
          }
          localStorage.setItem('tpf_cart', JSON.stringify(cart.filter(row => row.qty > 0)));
          localStorage.setItem(marker, '1');
        }
      }
    } catch { /* Order confirmation still works without local storage. */ }
  } catch (error) { title.textContent = 'Checking your order'; status.textContent = error.message; }
})();
