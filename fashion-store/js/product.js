/* Product detail page. The product id comes from the query string. */
(function (Aurel) {
  'use strict';

  const root = document.getElementById('productRoot');
  if (!root || document.body.dataset.page !== 'product') return;

  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  let product = null;
  let index = 0;
  let size = null;
  let color = null;
  let qty = 1;

  function show(next) {
    const images = product.images;
    index = (next + images.length) % images.length;
    const image = document.getElementById('galleryImg');
    const lightboxImage = document.getElementById('lbImg');
    image.classList.add('is-fading');
    window.setTimeout(() => {
      image.src = images[index];
      image.alt = `${product.name}, view ${index + 1}`;
      if (lightboxImage) lightboxImage.src = images[index];
      image.classList.remove('is-fading');
    }, 160);
    root.querySelectorAll('[data-thumb]').forEach((button, thumbIndex) => {
      button.classList.toggle('is-active', thumbIndex === index);
    });
  }

  function syncQty() {
    const label = document.getElementById('qtyVal');
    if (label) label.textContent = String(qty);
  }

  function render() {
    const discount = Aurel.Products.discountOf(product);
    color = product.colors[0];
    const thumbs = product.images.map((src, thumbIndex) => `
      <button type="button" class="thumb${thumbIndex === 0 ? ' is-active' : ''}" data-thumb="${thumbIndex}" aria-label="Show image ${thumbIndex + 1}">
        <img src="${src}" alt="" referrerpolicy="no-referrer">
      </button>`).join('');
    const sizes = product.sizes.map((item) => `<button type="button" data-size="${Aurel.escapeHtml(item)}">${Aurel.escapeHtml(item)}</button>`).join('');
    const colors = product.colors.map((item) => `
      <button type="button" class="color-option${item === color ? ' is-selected' : ''}" data-color="${Aurel.escapeHtml(item)}" aria-pressed="${item === color}">
        <span class="swatch" style="background:${Aurel.Products.colorHex(item)}"></span>
        <span>${Aurel.escapeHtml(item)}</span>
      </button>`).join('');
    const wished = Aurel.Wishlist.has(product.id);
    const related = Aurel.Products.related(product, 4);
    const recent = Aurel.Recent.products(product.id).slice(0, 4);
    const nav = product.images.length > 1
      ? `<button class="gal-nav prev" type="button" data-gal="-1" aria-label="Previous image">‹</button>
         <button class="gal-nav next" type="button" data-gal="1" aria-label="Next image">›</button>`
      : '';

    root.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="index.html">Home</a><span aria-hidden="true">/</span>
        <a href="shop.html?gender=${encodeURIComponent(product.category)}">${Aurel.escapeHtml(product.category)}</a><span aria-hidden="true">/</span>
        <a href="shop.html?gender=${encodeURIComponent(product.category)}&category=${encodeURIComponent(product.subcategory)}">${Aurel.escapeHtml(product.subcategory)}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${Aurel.escapeHtml(product.name)}</span>
      </nav>
      <div class="product-layout">
        <div class="gallery">
          <div class="gallery-main" id="galleryOpen" tabindex="0" aria-label="Product image. Press enter to enlarge.">
            ${nav}
            <img id="galleryImg" src="${product.images[0]}" alt="${Aurel.escapeHtml(product.name)}" referrerpolicy="no-referrer">
          </div>
          <div class="thumbs">${thumbs}</div>
        </div>
        <div class="product-info">
          <p class="eyebrow">${Aurel.escapeHtml(product.category)} · ${Aurel.escapeHtml(product.subcategory)}</p>
          <h1>${Aurel.escapeHtml(product.name)}</h1>
          <div class="card-meta">
            ${Aurel.Products.starsHTML(product.rating)}
            <span>${product.rating.toFixed(1)}</span>
            <span>${product.reviews} reviews</span>
          </div>
          <p class="price" style="margin:12px 0 16px">
            <span class="price-now">${Aurel.Products.formatPrice(product.price)}</span>
            ${discount ? `<span class="price-was">${Aurel.Products.formatPrice(product.originalPrice)}</span> <span class="badge badge-sale">−${discount}%</span>` : ''}
          </p>
          <p>${Aurel.escapeHtml(product.description)}</p>
          <div class="option-label"><span>Color</span><span id="colorLabel">${Aurel.escapeHtml(color)}</span></div>
          <div class="color-picks" id="colorOptions">${colors}</div>
          <div class="option-label">
            <span>Size</span>
            <button class="linkish js-size-guide" type="button">Size guide</button>
          </div>
          <div class="size-options" id="sizeOptions">${sizes}</div>
          <p class="fine" style="margin-top:8px">Model is 178 cm and wears size M. ${product.inStock ? `${product.stock} in the atelier, ready to ship.` : 'Sold out.'}</p>
          <div class="option-label"><span>Quantity</span></div>
          <div class="qty">
            <button type="button" id="qtyMinus" aria-label="Decrease quantity">−</button>
            <span id="qtyVal">1</span>
            <button type="button" id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>
          <div class="buy-row">
            <button class="btn btn-solid" type="button" id="productAdd" ${product.inStock ? '' : 'disabled'}>${product.inStock ? 'Add to cart' : 'Sold out'}</button>
            <button class="btn btn-ghost${wished ? ' is-active' : ''}" type="button" data-wish="${product.id}" aria-pressed="${wished}">
              ${Aurel.Products.heartIcon}
              <span class="wish-label">${wished ? 'Saved to wishlist' : 'Save to wishlist'}</span>
            </button>
          </div>
          <ul class="delivery">
            <li>Complimentary shipping on orders over ₹5,000. Otherwise ₹199.</li>
            <li>Dispatched in 1–2 business days. Delivered in 3–5 business days.</li>
            <li>14-day returns on unworn pieces with tags attached.</li>
          </ul>
        </div>
      </div>
      ${related.length ? `<section class="related"><div class="section-head"><div><p class="eyebrow">Worn with</p><h2>Related pieces</h2></div></div><div class="product-grid">${related.map(Aurel.Products.cardHTML).join('')}</div></section>` : ''}
      ${recent.length ? `<section class="related"><div class="section-head"><div><p class="eyebrow">Continue</p><h2>Recently viewed</h2></div></div><div class="product-grid">${recent.map(Aurel.Products.cardHTML).join('')}</div></section>` : ''}
      <div class="lightbox" id="lightbox" aria-hidden="true" role="dialog" aria-label="Enlarged product image">
        <button class="lb-close" type="button" data-lb-close>Close</button>
        ${product.images.length > 1 ? '<button class="gal-nav prev" type="button" data-lb="-1" aria-label="Previous image">‹</button>' : ''}
        <img id="lbImg" src="${product.images[0]}" alt="${Aurel.escapeHtml(product.name)}" referrerpolicy="no-referrer">
        ${product.images.length > 1 ? '<button class="gal-nav next" type="button" data-lb="1" aria-label="Next image">›</button>' : ''}
      </div>`;
    document.title = `${product.name} — AUREL`;
    if (Aurel.ui) Aurel.ui.syncHearts();
  }

  function unavailable() {
    root.innerHTML = `
      <div class="empty-state">
        <h1>This piece is unavailable</h1>
        <p>The link may be incomplete, or the piece is no longer in the edit.</p>
        <a class="btn btn-solid" href="shop.html">Back to shop</a>
      </div>`;
    document.title = 'Piece unavailable — AUREL';
  }

  root.addEventListener('click', (event) => {
    if (!product) return;
    const thumb = event.target.closest('[data-thumb]');
    if (thumb) {
      show(Number(thumb.dataset.thumb));
      return;
    }
    const step = event.target.closest('[data-gal]');
    if (step) {
      event.stopPropagation();
      show(index + Number(step.dataset.gal));
      return;
    }
    const lb = event.target.closest('[data-lb]');
    if (lb) {
      show(index + Number(lb.dataset.lb));
      return;
    }
    if (event.target.closest('[data-lb-close]')) {
      const box = document.getElementById('lightbox');
      box.classList.remove('is-open');
      box.setAttribute('aria-hidden', 'true');
      return;
    }
    if (event.target.id === 'lightbox') {
      event.target.classList.remove('is-open');
      event.target.setAttribute('aria-hidden', 'true');
      return;
    }
    if (event.target.closest('#galleryOpen') && !event.target.closest('.gal-nav')) {
      const box = document.getElementById('lightbox');
      document.getElementById('lbImg').src = product.images[index];
      box.classList.add('is-open');
      box.setAttribute('aria-hidden', 'false');
      return;
    }
    const sizeBtn = event.target.closest('#sizeOptions [data-size]');
    if (sizeBtn) {
      size = sizeBtn.dataset.size;
      document.getElementById('sizeOptions').classList.remove('needs-choice');
      document.querySelectorAll('#sizeOptions [data-size]').forEach((button) => {
        button.classList.toggle('is-selected', button === sizeBtn);
      });
      return;
    }
    const colorBtn = event.target.closest('#colorOptions [data-color]');
    if (colorBtn) {
      color = colorBtn.dataset.color;
      document.getElementById('colorLabel').textContent = color;
      document.querySelectorAll('#colorOptions [data-color]').forEach((button) => {
        const on = button === colorBtn;
        button.classList.toggle('is-selected', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return;
    }
    if (event.target.closest('#qtyMinus')) {
      qty = Math.max(1, qty - 1);
      syncQty();
      return;
    }
    if (event.target.closest('#qtyPlus')) {
      const room = Aurel.Products.remaining(product.id);
      if (qty >= room) {
        Aurel.ui.toast(room > 0 ? `Only ${room} left in stock` : 'This piece is sold out', 'error');
        return;
      }
      qty = Math.min(8, room, qty + 1);
      syncQty();
      return;
    }
    if (event.target.closest('#productAdd')) {
      if (!product.inStock) return;
      if (!size) {
        document.getElementById('sizeOptions').classList.add('needs-choice');
        Aurel.ui.toast('Select a size to continue', 'error');
        return;
      }
      Aurel.Cart.add({ id: product.id, size, color, qty });
    }
  });

  root.addEventListener('keydown', (event) => {
    const lightbox = document.getElementById('lightbox');
    const lightboxOpen = lightbox && lightbox.classList.contains('is-open');
    if (lightboxOpen && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (!product || !event.target.closest('#galleryOpen')) return;
    if (event.key === 'ArrowRight') show(index + 1);
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      document.getElementById('galleryOpen').click();
    }
  });

  Aurel.Products.load().then(() => {
    product = Aurel.Products.getById(id);
    if (!product) {
      unavailable();
      return;
    }
    Aurel.Recent.add(product.id);
    render();
  }).catch(() => {
    root.innerHTML = '<div class="empty-state"><h1>The piece could not load</h1><p>Refresh the page and try again.</p><button class="btn btn-solid" type="button" data-reload>Try again</button></div>';
  });
})(window.Aurel = window.Aurel || {});
