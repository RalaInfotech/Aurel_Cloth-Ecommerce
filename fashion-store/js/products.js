/* Product data, formatting, and card markup. data/data.json is the only catalog. */
(function (Aurel) {
  'use strict';

  const COLORS = {
    Black: '#1c1c1c',
    Navy: '#1d2a44',
    Beige: '#d9c7a7',
    Camel: '#c4a574',
    Charcoal: '#3d4348',
    Ivory: '#f3efe4',
    White: '#f7f7f5',
    Sky: '#c5d5e4',
    Burgundy: '#6d2432',
    Olive: '#5d6548',
    Cream: '#f3eadc',
    Indigo: '#2c3a5f',
    Taupe: '#a89884',
    Brown: '#6a432c',
    Sage: '#b7c4b0',
    Sand: '#e6d5c3',
    Khaki: '#c6b48a',
    Forest: '#2e463a',
    Champagne: '#f0e2c8',
    Emerald: '#0f6a52',
    Stone: '#c9c3b8',
    Blush: '#e7cfc9',
    Heather: '#b9b9b9',
    Ecru: '#f1e6d4',
    Chocolate: '#5c382c',
    Grey: '#8d8d8d',
    Powder: '#d5e0ea',
    Wine: '#6e2e3c'
  };

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19s-7-4.4-7-8.5C5 8 6.8 6.5 8.8 6.5c1.2 0 2.2.6 3.2 1.8 1-1.2 2-1.8 3.2-1.8 2 0 3.8 1.5 3.8 4C19 14.6 12 19 12 19z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  let cache = null;
  let pending = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* Private mode or a full quota should not break the shop. */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        /* ignore */
      }
    }
  };

  function normalizeProduct(product) {
    const copy = Object.assign({}, product);
    const stock = Number.isFinite(Number(copy.stock))
      ? Math.max(0, Math.round(Number(copy.stock)))
      : (copy.inStock === false ? 0 : 8 + (Number(copy.id) % 17));
    copy.stock = stock;
    copy.inStock = stock > 0;
    return copy;
  }

  function normalizeList(list) {
    return list.map(normalizeProduct);
  }

  function adopt(data) {
    if (!Array.isArray(data) || !data.length) throw new Error('Product data is not a list.');
    cache = normalizeList(data);
    return cache;
  }

  function savedCatalog() {
    const saved = storage.get('aurel_catalog', null);
    return Array.isArray(saved) && saved.length ? saved : null;
  }

  /* Studio edits live in this browser. Otherwise data.json is read, and
     catalog.js is the same list for when the page is opened as a file. */
  function load() {
    if (cache) return Promise.resolve(cache);
    if (pending) return pending;
    const saved = savedCatalog();
    if (saved) return Promise.resolve(adopt(saved));
    const embedded = window.AUREL_CATALOG;
    if (location.protocol === 'file:' && Array.isArray(embedded) && embedded.length) {
      return Promise.resolve(adopt(embedded));
    }
    pending = fetch('data/data.json')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the collection.');
        return response.json();
      })
      .then(adopt)
      .catch(() => {
        if (Array.isArray(embedded) && embedded.length) return adopt(embedded);
        pending = null;
        throw new Error('Could not load the collection.');
      });
    return pending;
  }

  function commit(list) {
    const next = normalizeList(list);
    if (!next.length) throw new Error('Keep at least one piece in the collection.');
    storage.set('aurel_catalog', next);
    cache = next;
    document.dispatchEvent(new CustomEvent('aurel:catalog'));
    return next;
  }

  function resetCatalog() {
    storage.remove('aurel_catalog');
    cache = null;
    pending = null;
    return load();
  }

  function reload() {
    cache = null;
    pending = null;
    return load();
  }

  function replaceProduct(product) {
    const list = (cache || []).slice();
    const index = list.findIndex((item) => item.id === Number(product.id));
    if (index === -1) list.unshift(product);
    else list[index] = product;
    return commit(list);
  }

  function removeProduct(id) {
    return commit((cache || []).filter((item) => item.id !== Number(id)));
  }

  function takeStock(lines) {
    const list = (cache || []).map((item) => Object.assign({}, item));
    (lines || []).forEach((line) => {
      const product = list.find((item) => item.id === Number(line.id));
      if (!product) return;
      product.stock = Math.max(0, Number(product.stock) - Number(line.qty || 0));
    });
    return commit(list);
  }

  function recordOrder(order) {
    const current = storage.get('aurel_orders', []);
    const next = [order].concat(Array.isArray(current) ? current : []).slice(0, 40);
    storage.set('aurel_orders', next);
    return next;
  }

  function orders() {
    const list = storage.get('aurel_orders', []);
    return Array.isArray(list) ? list : [];
  }

  function remaining(id) {
    const product = getById(id);
    if (!product) return 0;
    const held = Aurel.Cart
      ? Aurel.Cart.get().filter((line) => line.id === Number(id)).reduce((sum, line) => sum + line.qty, 0)
      : 0;
    return Math.max(0, Number(product.stock) - held);
  }

  function nextId() {
    return (cache || []).reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
  }

  function formatPrice(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  }

  function discountOf(product) {
    if (!product || !(product.originalPrice > product.price)) return 0;
    return product.discount > 0
      ? product.discount
      : Math.round((1 - product.price / product.originalPrice) * 100);
  }

  function getById(id) {
    return (cache || []).find((product) => product.id === Number(id)) || null;
  }

  function starsHTML(rating) {
    const value = Number(rating) || 0;
    return `<span class="stars" style="--rating:${value}" role="img" aria-label="Rated ${value.toFixed(1)} out of 5"></span>`;
  }

  function cardHTML(product) {
    const discount = discountOf(product);
    const secondary = product.images[1] || product.images[0];
    const wished = Aurel.Wishlist && Aurel.Wishlist.has(product.id);
    return `
      <article class="product-card${secondary !== product.images[0] ? ' has-alt' : ''}">
        <div class="card-image">
          <a href="product.html?id=${product.id}">
            <img class="img-primary" src="${product.images[0]}" alt="${escapeHtml(product.name)}" width="900" height="1200" loading="lazy" decoding="async" referrerpolicy="no-referrer">
            <img class="img-secondary" src="${secondary}" alt="" width="900" height="1200" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          </a>
          <div class="badges">
            ${discount ? `<span class="badge badge-sale">−${discount}%</span>` : ''}
            ${product.inStock ? '' : '<span class="badge badge-stock">Sold out</span>'}
          </div>
          <button class="wish-btn${wished ? ' is-active' : ''}" type="button" data-wish="${product.id}" aria-pressed="${wished ? 'true' : 'false'}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}">${HEART}</button>
          <div class="card-actions">
            <button class="btn btn-ghost" type="button" data-quick="${product.id}">Quick view</button>
            <button class="btn btn-ghost" type="button" data-add="${product.id}" ${product.inStock ? '' : 'disabled'}>${product.inStock ? 'Add to cart' : 'Sold out'}</button>
          </div>
        </div>
        <div class="card-body">
          <p class="eyebrow">${escapeHtml(product.category)} · ${escapeHtml(product.subcategory)}</p>
          <h3 class="card-title"><a href="product.html?id=${product.id}">${escapeHtml(product.name)}</a></h3>
          <div class="card-meta">
            ${starsHTML(product.rating)}
            <span class="rating-num">${Number(product.rating).toFixed(1)}</span>
            <span class="reviews">(${product.reviews})</span>
          </div>
          <div class="price">
            <span class="price-now">${formatPrice(product.price)}</span>
            ${discount ? `<span class="price-was">${formatPrice(product.originalPrice)}</span>` : ''}
          </div>
        </div>
      </article>`;
  }

  function skeletonCards(count) {
    return Array.from({ length: count }, () => `
      <article class="skeleton-card" aria-hidden="true">
        <div class="skeleton sk-img"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
      </article>`).join('');
  }

  function related(product, limit) {
    const pool = cache || [];
    const ranked = [
      ...pool.filter((item) => item.id !== product.id && item.subcategory === product.subcategory),
      ...pool.filter((item) => item.id !== product.id && item.category === product.category && item.subcategory !== product.subcategory)
    ];
    const seen = new Set();
    const items = [];
    ranked.forEach((item) => {
      if (seen.has(item.id) || items.length >= (limit || 4)) return;
      seen.add(item.id);
      items.push(item);
    });
    return items;
  }

  const Recent = {
    key: 'aurel_recent',
    get() {
      const list = storage.get(this.key, []);
      return Array.isArray(list) ? list.map(Number).filter(Boolean) : [];
    },
    add(id) {
      const next = [Number(id), ...this.get().filter((item) => item !== Number(id))].slice(0, 8);
      storage.set(this.key, next);
    },
    products(exceptId) {
      return this.get()
        .filter((id) => id !== Number(exceptId))
        .map(getById)
        .filter(Boolean);
    }
  };

  Aurel.storage = storage;
  Aurel.escapeHtml = escapeHtml;
  Aurel.Recent = Recent;
  Aurel.Products = {
    load,
    ready: () => !!cache,
    all: () => cache || [],
    getById,
    formatPrice,
    discountOf,
    starsHTML,
    cardHTML,
    skeletonCards,
    related,
    colorHex: (name) => COLORS[name] || '#c8c2b8',
    heartIcon: HEART,
    commit,
    resetCatalog,
    reload,
    replaceProduct,
    removeProduct,
    takeStock,
    recordOrder,
    orders,
    remaining,
    nextId,
    usingStudio: () => !!savedCatalog()
  };
})(window.Aurel = window.Aurel || {});
