/* Cart state in localStorage, with price, discount, shipping, and promo math. */
(function (Aurel) {
  'use strict';

  const KEY = 'aurel_cart';
  const PROMO_KEY = 'aurel_promo';
  const FREE_AT = 5000;
  const SHIPPING_FEE = 199;

  function emit() {
    document.dispatchEvent(new CustomEvent('aurel:cart'));
  }

  function get() {
    const lines = Aurel.storage.get(KEY, []);
    if (!Array.isArray(lines)) return [];
    return lines.filter((line) => line && line.id && line.qty > 0 && line.size && line.color);
  }

  function save(lines) {
    Aurel.storage.set(KEY, lines);
    emit();
  }

  function clampQty(value) {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number)) return 1;
    return Math.min(8, Math.max(1, number));
  }

  function lineKey(line) {
    return `${line.id}|${line.size}|${line.color}`;
  }

  function parseKey(key) {
    const [id, size, ...color] = String(key).split('|');
    return { id: Number(id), size, color: color.join('|') };
  }

  function findLine(lines, id, size, color) {
    return lines.find((line) => line.id === Number(id) && line.size === size && line.color === color);
  }

  function add(item, options) {
    const opts = options || {};
    const product = Aurel.Products.getById(item.id);
    if (!product) {
      if (Aurel.ui) Aurel.ui.toast('This piece is no longer available', 'error');
      return null;
    }
    if (!product.inStock) {
      if (Aurel.ui) Aurel.ui.toast('This piece is sold out', 'error');
      return null;
    }
    const size = item.size || product.sizes[0];
    const color = item.color || product.colors[0];
    const qty = clampQty(item.qty || 1);
    const lines = get();
    const existing = findLine(lines, product.id, size, color);
    let updated = false;
    if (existing) {
      const next = existing.qty + qty;
      if (next > 8) {
        if (Aurel.ui && !opts.silent) Aurel.ui.toast('Maximum quantity is 8', 'error');
        existing.qty = 8;
      } else {
        existing.qty = next;
      }
      updated = true;
    } else {
      lines.push({ id: product.id, size, color, qty });
    }
    save(lines);
    if (!opts.silent && Aurel.ui) {
      const lead = updated ? 'Quantity updated in cart' : 'Added to cart';
      Aurel.ui.toast(`${lead} — ${product.name}, size ${size}, ${color}`);
    }
    return { updated, size, color };
  }

  function update(key, direction) {
    const lines = get();
    const parsed = parseKey(key);
    const line = findLine(lines, parsed.id, parsed.size, parsed.color);
    if (!line) return;
    if (line.qty >= 8 && direction > 0) {
      if (Aurel.ui) Aurel.ui.toast('Maximum quantity is 8', 'error');
      return;
    }
    const next = line.qty + direction;
    if (next < 1) return;
    line.qty = clampQty(next);
    save(lines);
  }

  function remove(key) {
    const parsed = parseKey(key);
    const current = get();
    const removed = findLine(current, parsed.id, parsed.size, parsed.color);
    if (!removed) return;
    const product = Aurel.Products.getById(removed.id);
    save(current.filter((line) => line !== removed));
    if (Aurel.ui) {
      Aurel.ui.toast(`Removed from cart — ${product ? product.name : 'Piece'}`, {
        action: 'Undo',
        onAction() {
          add(removed, { silent: true });
          Aurel.ui.toast('Restored to cart');
        }
      });
    }
  }

  function changeOption(key, changes) {
    const parsed = parseKey(key);
    const lines = get();
    const line = findLine(lines, parsed.id, parsed.size, parsed.color);
    if (!line) return;
    const nextSize = changes.size || line.size;
    const nextColor = changes.color || line.color;
    const duplicate = lines.find((other) => other !== line && other.id === line.id && other.size === nextSize && other.color === nextColor);
    if (duplicate) {
      duplicate.qty = clampQty(duplicate.qty + line.qty);
      lines.splice(lines.indexOf(line), 1);
    } else {
      line.size = nextSize;
      line.color = nextColor;
    }
    save(lines);
  }

  function promoCode() {
    const value = Aurel.storage.get(PROMO_KEY, '');
    return typeof value === 'string' ? value : '';
  }

  function applyPromo(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) {
      Aurel.storage.remove(PROMO_KEY);
      emit();
      return { ok: true, message: 'Promo removed' };
    }
    if (normalized !== 'AUREL10' && normalized !== 'ATELIER') {
      return { ok: false, message: 'That code is not recognised' };
    }
    Aurel.storage.set(PROMO_KEY, normalized);
    emit();
    return { ok: true, message: 'Promo applied' };
  }

  function totals() {
    const lines = get();
    let list = 0;
    let sale = 0;
    const detailed = [];
    lines.forEach((line) => {
      const product = Aurel.Products.getById(line.id);
      if (!product) return;
      list += product.originalPrice * line.qty;
      sale += product.price * line.qty;
      detailed.push({ ...line, product });
    });
    const itemDiscount = Math.max(0, list - sale);
    const code = promoCode();
    let promoDiscount = 0;
    let promoNote = '';
    if (code === 'AUREL10') {
      promoDiscount = Math.round(sale * 0.1);
    } else if (code === 'ATELIER') {
      if (sale >= 4000) promoDiscount = 750;
      else if (sale > 0) promoNote = `Add ${Aurel.Products.formatPrice(4000 - sale)} more for ATELIER.`;
    }
    promoDiscount = Math.min(promoDiscount, sale);
    const merchandise = Math.max(0, sale - promoDiscount);
    const shipping = merchandise === 0 ? 0 : (sale >= FREE_AT ? 0 : SHIPPING_FEE);
    const count = detailed.reduce((sum, line) => sum + line.qty, 0);
    return {
      lines: detailed,
      list,
      sale,
      itemDiscount,
      promoDiscount,
      promoNote,
      code,
      shipping,
      total: merchandise + shipping,
      count,
      freeAt: FREE_AT,
      remain: Math.max(0, FREE_AT - sale)
    };
  }

  function money(amount) {
    return Aurel.Products.formatPrice(amount);
  }

  function lineHTML(entry) {
    const product = entry.product;
    const key = lineKey(entry);
    const safeKey = Aurel.escapeHtml(key);
    const unitWas = product.originalPrice > product.price;
    const sizeOptions = product.sizes.map((size) => `<option value="${Aurel.escapeHtml(size)}"${size === entry.size ? ' selected' : ''}>${Aurel.escapeHtml(size)}</option>`).join('');
    const colorOptions = product.colors.map((color) => `<option value="${Aurel.escapeHtml(color)}"${color === entry.color ? ' selected' : ''}>${Aurel.escapeHtml(color)}</option>`).join('');
    return `
      <article class="line">
        <a href="product.html?id=${product.id}"><img src="${product.images[0]}" alt="${Aurel.escapeHtml(product.name)}" referrerpolicy="no-referrer"></a>
        <div>
          <p class="eyebrow">${Aurel.escapeHtml(product.subcategory)}</p>
          <h3><a href="product.html?id=${product.id}">${Aurel.escapeHtml(product.name)}</a></h3>
          <div class="line-options">
            <label>Size
              <select data-line-size="${safeKey}" aria-label="Size for ${Aurel.escapeHtml(product.name)}">${sizeOptions}</select>
            </label>
            <label>Color
              <select data-line-color="${safeKey}" aria-label="Color for ${Aurel.escapeHtml(product.name)}">${colorOptions}</select>
            </label>
          </div>
          <div class="line-bottom">
            <div class="qty">
              <button type="button" data-qty="${safeKey}" data-dir="-1" aria-label="Decrease quantity">−</button>
              <span>${entry.qty}</span>
              <button type="button" data-qty="${safeKey}" data-dir="1" aria-label="Increase quantity">+</button>
            </div>
            <button type="button" class="linkish" data-remove="${safeKey}">Remove</button>
          </div>
        </div>
        <div class="line-price">
          <strong>${money(product.price * entry.qty)}</strong>
          ${unitWas ? `<s>${money(product.originalPrice * entry.qty)}</s>` : ''}
        </div>
      </article>`;
  }

  function totalsHTML(summary) {
    const shippingLabel = summary.shipping === 0 ? 'Complimentary' : money(summary.shipping);
    const promoRow = summary.code
      ? `<div><dt>Promo ${Aurel.escapeHtml(summary.code)}</dt><dd>${summary.promoDiscount ? '−' + money(summary.promoDiscount) : '—'}</dd></div>`
      : '';
    const progress = summary.sale <= 0
      ? ''
      : `<p class="ship-note">${summary.remain === 0 ? 'Complimentary shipping is included.' : `${money(summary.remain)} away from complimentary shipping.`}</p>
         <div class="ship-bar" aria-hidden="true"><span style="width:${Math.min(100, (summary.sale / summary.freeAt) * 100)}%"></span></div>`;
    return `
      ${progress}
      <dl class="totals">
        <div><dt>Subtotal</dt><dd>${money(summary.list)}</dd></div>
        <div><dt>Discount</dt><dd>${summary.itemDiscount ? '−' + money(summary.itemDiscount) : money(0)}</dd></div>
        ${promoRow}
        <div><dt>Shipping</dt><dd>${shippingLabel}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${money(summary.total)}</dd></div>
      </dl>
      ${summary.promoNote ? `<p class="fine">${summary.promoNote}</p>` : ''}`;
  }

  function promoFormHTML() {
    const code = promoCode();
    return `
      <form class="promo-form" data-promo-form>
        <label class="sr-only" for="promoInput">Promo code</label>
        <input id="promoInput" name="code" type="text" placeholder="Promo code" value="${Aurel.escapeHtml(code)}" autocomplete="off">
        <button class="btn btn-ghost" type="submit">${code ? 'Update' : 'Apply'}</button>
      </form>
      <p class="fine">Try AUREL10 for 10% off, or ATELIER for ₹750 off orders of ₹4,000 or more.</p>
      ${code ? '<button type="button" class="linkish" data-clear-promo>Remove promo</button>' : ''}`;
  }

  function renderPage() {
    const root = document.getElementById('cartPage');
    if (!root) return;
    if (!Aurel.Products.ready()) {
      root.innerHTML = '<p class="muted pad">Loading your cart…</p>';
      Aurel.Products.load().then(renderPage).catch(() => {
        root.innerHTML = '<div class="empty-state"><h2>The cart could not load</h2><p>Check your connection and try again.</p><button class="btn btn-solid" type="button" data-reload>Try again</button></div>';
      });
      return;
    }
    const summary = totals();
    if (!summary.lines.length) {
      root.innerHTML = `
        <div class="empty-state">
          <h2>Your cart is empty</h2>
          <p>The edit is waiting. Pieces you add will stay on this device.</p>
          <a class="btn btn-solid" href="shop.html">Continue shopping</a>
        </div>`;
      return;
    }
    root.innerHTML = `
      <div class="cart-layout">
        <div>${summary.lines.map(lineHTML).join('')}</div>
        <aside class="summary-card">
          <h2>Summary</h2>
          ${totalsHTML(summary)}
          ${promoFormHTML()}
          <a class="btn btn-solid btn-full" href="checkout.html">Checkout</a>
        </aside>
      </div>`;
  }

  function renderDrawer() {
    const body = document.getElementById('drawerBody');
    const foot = document.getElementById('drawerFoot');
    const count = document.getElementById('drawerCount');
    if (!body || !foot) return;
    if (!Aurel.Products.ready()) {
      body.innerHTML = '<p class="muted pad">Loading…</p>';
      foot.innerHTML = '';
      Aurel.Products.load().then(renderDrawer).catch(() => {
        body.innerHTML = '<p class="pad">Product details could not be loaded.</p>';
      });
      return;
    }
    const summary = totals();
    if (count) count.textContent = summary.count ? `(${summary.count})` : '';
    if (!summary.lines.length) {
      body.innerHTML = `
        <div class="empty-state">
          <h2>Your cart is empty</h2>
          <p>Add a piece to see it here.</p>
          <a class="btn btn-solid" href="shop.html" data-close>Shop the edit</a>
        </div>`;
      foot.innerHTML = '';
      return;
    }
    body.innerHTML = summary.lines.map(lineHTML).join('');
    foot.innerHTML = `
      ${totalsHTML(summary)}
      <a class="btn btn-solid btn-full" href="checkout.html">Checkout</a>
      <a class="btn btn-ghost btn-full" href="cart.html">View cart</a>`;
  }

  function clear(options) {
    Aurel.storage.set(KEY, []);
    Aurel.storage.remove(PROMO_KEY);
    if (!options || !options.silent) emit();
    else emit();
  }

  Aurel.CONFIG = { freeShippingAt: FREE_AT, shippingFee: SHIPPING_FEE };
  Aurel.Cart = {
    get,
    add,
    update,
    remove,
    changeOption,
    totals,
    applyPromo,
    promoCode,
    clear,
    renderPage,
    renderDrawer,
    lineKey,
    count: () => get().reduce((sum, line) => sum + Number(line.qty || 0), 0)
  };

  if (document.body && document.body.dataset.page === 'cart') {
    Aurel.Products.load().then(renderPage).catch(() => renderPage());
    document.addEventListener('aurel:cart', renderPage);
  }
})(window.Aurel = window.Aurel || {});
