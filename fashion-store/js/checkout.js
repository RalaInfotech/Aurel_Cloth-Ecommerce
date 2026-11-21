/* Demo checkout. Nothing is sent to a server and no payment is taken. */
(function (Aurel) {
  'use strict';

  if (!document.body || document.body.dataset.page !== 'checkout') return;

  const empty = document.getElementById('checkoutEmpty');
  const confirmed = document.getElementById('checkoutConfirmed');
  const layout = document.getElementById('checkoutLayout');
  const loading = document.getElementById('checkoutLoading');
  const summary = document.getElementById('orderSummary');
  const form = document.getElementById('checkoutForm');
  const place = document.getElementById('placeOrder');
  let locked = false;

  function show(which) {
    loading.hidden = which !== 'loading';
    empty.hidden = which !== 'empty';
    confirmed.hidden = which !== 'confirmed';
    layout.hidden = which !== 'form';
  }

  function paintSummary() {
    const totals = Aurel.Cart.totals();
    const items = totals.lines.map((line) => `
      <article class="line">
        <img src="${line.product.images[0]}" alt="" referrerpolicy="no-referrer">
        <div>
          <h3>${Aurel.escapeHtml(line.product.name)}</h3>
          <p class="fine">${Aurel.escapeHtml(line.color)} · Size ${Aurel.escapeHtml(line.size)} · Qty ${line.qty}</p>
        </div>
        <div class="line-price"><strong>${Aurel.Products.formatPrice(line.product.price * line.qty)}</strong></div>
      </article>`).join('');
    summary.innerHTML = `${items}<div style="margin-top:12px">${totalsBlock(totals)}</div>`;
    if (place && !locked) place.textContent = `Place order · ${Aurel.Products.formatPrice(totals.total)}`;
    paintScanner();
  }

  function totalsBlock(totals) {
    const shipping = totals.shipping === 0 ? 'Complimentary' : Aurel.Products.formatPrice(totals.shipping);
    const promo = totals.code
      ? `<div><dt>Promo ${Aurel.escapeHtml(totals.code)}</dt><dd>${totals.promoDiscount ? '−' + Aurel.Products.formatPrice(totals.promoDiscount) : '—'}</dd></div>`
      : '';
    return `
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${Aurel.Products.formatPrice(totals.list)}</dd></div>
        <div><dt>Discount</dt><dd>${totals.itemDiscount ? '−' + Aurel.Products.formatPrice(totals.itemDiscount) : Aurel.Products.formatPrice(0)}</dd></div>
        ${promo}
        <div><dt>Shipping</dt><dd>${shipping}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${Aurel.Products.formatPrice(totals.total)}</dd></div>
      </dl>
      ${totals.promoNote ? `<p class="fine">${totals.promoNote}</p>` : ''}`;
  }

  function orderId() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const salt = Math.floor(1000 + Math.random() * 9000);
    return `AUR-${stamp}-${salt}`;
  }

  function paintScanner() {
    const host = document.getElementById('upiQr');
    const amount = document.getElementById('upiAmount');
    if (!host || !Aurel.qrSvg) return;
    const total = Aurel.Cart.totals().total;
    const rupees = Number(total).toFixed(2);
    if (amount) amount.textContent = Aurel.Products.formatPrice(total);
    const payload = `upi://pay?pa=aurel.demo@upi&pn=AUREL&am=${rupees}&cu=INR&tn=AUREL`;
    try {
      host.innerHTML = Aurel.qrSvg(payload);
    } catch (err) {
      host.textContent = 'The scanner could not be drawn.';
    }
  }

  function clearErrors() {
    form.querySelectorAll('.field').forEach((field) => field.classList.remove('is-error'));
    form.querySelectorAll('.field-error').forEach((node) => node.remove());
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  }

  function showError(name, message) {
    const input = form.elements[name];
    const control = input && !input.tagName ? input[0] : input;
    if (!control || !control.closest) return;
    const field = control.closest('.field');
    if (!field) return;
    field.classList.add('is-error');
    control.setAttribute('aria-invalid', 'true');
    const note = document.createElement('p');
    note.className = 'field-error';
    note.setAttribute('role', 'alert');
    note.textContent = message;
    field.appendChild(note);
  }

  function validate() {
    clearErrors();
    const data = Object.fromEntries(new FormData(form).entries());
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) errors.email = 'Enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(data.phone || '')) errors.phone = 'Enter a 10-digit mobile number.';
    if ((data.firstName || '').trim().length < 2) errors.firstName = 'Enter your first name.';
    if ((data.lastName || '').trim().length < 2) errors.lastName = 'Enter your last name.';
    if ((data.address || '').trim().length < 5) errors.address = 'Enter your street address.';
    if ((data.city || '').trim().length < 2) errors.city = 'Enter your city.';
    if ((data.state || '').trim().length < 2) errors.state = 'Enter your state.';
    if (!/^\d{6}$/.test(data.postal || '')) errors.postal = 'Enter a 6-digit postal code.';
    if (data.payment !== 'upi' && data.payment !== 'cod') errors.payment = 'Choose a payment method.';
    const names = Object.keys(errors);
    names.forEach((name) => showError(name, errors[name]));
    if (names.length) {
      const first = form.elements[names[0]];
      if (first && first.focus) first.focus();
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return data;
  }

  function syncPayment() {
    const selected = form.querySelector('input[name="payment"]:checked');
    const method = selected ? selected.value : 'upi';
    document.querySelectorAll('[data-pay-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.payPanel !== method;
    });
  }

  function renderConfirmation(order) {
    const rows = order.items.map((item) => `
      <li>
        <span>${Aurel.escapeHtml(item.name)} · ${Aurel.escapeHtml(item.color)} / ${Aurel.escapeHtml(item.size)} × ${item.qty}</span>
        <strong>${Aurel.Products.formatPrice(item.total)}</strong>
      </li>`).join('');
    confirmed.innerHTML = `
      <p class="eyebrow">Order confirmed</p>
      <h1>Thank you, ${Aurel.escapeHtml(order.name)}.</h1>
      <p class="order-id">${Aurel.escapeHtml(order.id)}</p>
      <p class="muted" style="margin-top:12px">A confirmation is ready for ${Aurel.escapeHtml(order.email)}. This is a demonstration — no payment was taken and nothing was sent to a server.</p>
      <ul class="confirm-list">${rows}</ul>
      <p><strong>Total ${Aurel.Products.formatPrice(order.total)}</strong> · ${Aurel.escapeHtml(order.method)}</p>
      <p class="fine" style="margin:10px 0 20px">${Aurel.escapeHtml(order.address)}</p>
      <a class="btn btn-solid" href="shop.html">Continue shopping</a>`;
    show('confirmed');
    document.title = 'Order confirmed — AUREL';
  }

  function refresh() {
    if (locked) return;
    if (!Aurel.Cart.totals().count) {
      show('empty');
      return;
    }
    show('form');
    paintSummary();
  }

  function bind() {
    form.addEventListener('change', (event) => {
      if (event.target.name === 'payment') syncPayment();
    });
    form.elements.phone.addEventListener('input', () => {
      form.elements.phone.value = form.elements.phone.value.replace(/\D/g, '').slice(0, 10);
    });
    form.elements.postal.addEventListener('input', () => {
      form.elements.postal.value = form.elements.postal.value.replace(/\D/g, '').slice(0, 6);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (locked) return;
      if (!Aurel.Cart.totals().count) {
        show('empty');
        return;
      }
      const data = validate();
      if (!data) return;
      const totals = Aurel.Cart.totals();
      const methods = { upi: 'UPI', cod: 'Cash on delivery' };
      const order = {
        id: orderId(),
        email: data.email.trim(),
        name: data.firstName.trim(),
        phone: data.phone.trim(),
        address: [data.address, data.apartment, data.city, data.state, data.postal].map((part) => (part || '').trim()).filter(Boolean).join(', '),
        method: methods[data.payment] || 'UPI',
        items: totals.lines.map((line) => ({
          id: line.id,
          name: line.product.name,
          qty: line.qty,
          size: line.size,
          color: line.color,
          total: line.product.price * line.qty
        })),
        total: totals.total,
        placedAt: new Date().toISOString()
      };
      locked = true;
      place.disabled = true;
      place.textContent = 'Placing order…';
      window.setTimeout(() => {
        sessionStorage.setItem('aurel_last_order', JSON.stringify(order));
        Aurel.Products.takeStock(totals.lines);
        Aurel.Products.recordOrder(order);
        renderConfirmation(order);
        Aurel.ui.toast('Order placed successfully');
        Aurel.Cart.clear();
        history.replaceState(null, '', 'checkout.html?confirmed=1');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 700);
    });
  }

  const params = new URLSearchParams(location.search);
  if (params.get('confirmed') === '1') {
    try {
      const saved = JSON.parse(sessionStorage.getItem('aurel_last_order') || 'null');
      if (saved && saved.id) {
        locked = true;
        renderConfirmation(saved);
        return;
      }
    } catch (err) {
      /* Fall through to a normal checkout if the saved order cannot be read. */
    }
  }

  bind();
  syncPayment();
  Aurel.Products.load().then(refresh).catch(() => {
    loading.hidden = true;
    empty.hidden = false;
    empty.querySelector('p').textContent = 'Checkout could not load the collection.';
  });
  document.addEventListener('aurel:cart', refresh);
})(window.Aurel = window.Aurel || {});
