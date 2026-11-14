/* Shared interface: navigation, search, cart drawer, quick view, toasts, and the home page. */
(function (Aurel) {
  'use strict';

  const ui = {};
  let lastFocus = null;
  let searchIndex = -1;

  function toast(message, type) {
    let options = {};
    if (typeof type === 'object' && type) {
      options = type;
      type = options.type || 'success';
    }
    const region = document.getElementById('toasts');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast' + (type === 'error' ? ' error' : '');
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const text = document.createElement('span');
    text.textContent = message;
    node.appendChild(text);
    if (options.action && options.onAction) {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = options.action;
      action.addEventListener('click', () => {
        options.onAction();
        node.remove();
      });
      node.appendChild(action);
    }
    region.appendChild(node);
    while (region.children.length > 3) region.firstElementChild.remove();
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 300);
    }, 3200);
  }

  function portal() {
    let root = document.getElementById('portal');
    if (!root) {
      root = document.createElement('div');
      root.id = 'portal';
      document.body.appendChild(root);
    }
    if (!document.getElementById('toasts')) {
      const live = document.createElement('div');
      live.id = 'toasts';
      live.className = 'toasts';
      live.setAttribute('aria-live', 'polite');
      document.body.appendChild(live);
    }
    root.innerHTML = `
      <div class="backdrop" id="backdrop" hidden></div>
      <aside class="cart-drawer" id="cartDrawer" aria-hidden="true" aria-label="Shopping cart">
        <div class="drawer-head">
          <h2>Cart <span id="drawerCount"></span></h2>
          <button class="icon-btn" type="button" data-close aria-label="Close cart">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="drawer-body" id="drawerBody"></div>
        <div class="drawer-foot" id="drawerFoot"></div>
      </aside>
      <div class="search-modal" id="searchModal" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Search">
        <div class="wrap">
          <div class="search-top">
            <label class="sr-only" for="searchInput">Search the atelier</label>
            <input id="searchInput" type="search" placeholder="Search the atelier" autocomplete="off">
            <button class="btn btn-ghost" type="button" data-close>Close</button>
          </div>
          <div id="searchResults" class="search-results" aria-live="polite"></div>
        </div>
      </div>
      <div class="modal-layer" id="modalLayer" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Dialog">
        <div class="modal-card" id="modalCard"></div>
      </div>`;
    document.getElementById('backdrop').hidden = false;
  }

  function overlaysOpen() {
    return document.body.classList.contains('open-cart')
      || document.body.classList.contains('open-search')
      || document.body.classList.contains('open-modal')
      || document.body.classList.contains('open-filters')
      || document.body.classList.contains('menu-open');
  }

  function setInertFilters() {
    const filters = document.getElementById('filters');
    if (!filters) return;
    const desktop = window.innerWidth >= 1025;
    const open = document.body.classList.contains('open-filters');
    if (desktop || open) filters.removeAttribute('inert');
    else filters.setAttribute('inert', '');
  }

  function closeOverlays(options) {
    const restore = !options || options.restore !== false;
    document.body.classList.remove('lock-scroll', 'open-cart', 'open-search', 'open-modal', 'open-filters', 'menu-open');
    const backdrop = document.getElementById('backdrop');
    if (backdrop) backdrop.classList.remove('is-on');
    const drawer = document.getElementById('cartDrawer');
    const search = document.getElementById('searchModal');
    const modal = document.getElementById('modalLayer');
    if (drawer) drawer.setAttribute('aria-hidden', 'true');
    if (search) search.setAttribute('aria-hidden', 'true');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('mobileMenu');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (menu) menu.setAttribute('aria-hidden', 'true');
    setInertFilters();
    if (restore && lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    if (restore) lastFocus = null;
  }

  function beginOverlay() {
    const trigger = document.activeElement;
    closeOverlays({ restore: false });
    lastFocus = trigger && trigger !== document.body ? trigger : lastFocus;
  }

  function openCart() {
    beginOverlay();
    document.body.classList.add('lock-scroll', 'open-cart');
    document.getElementById('backdrop').classList.add('is-on');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
    Aurel.Cart.renderDrawer();
    const closeBtn = document.querySelector('#cartDrawer [data-close]');
    if (closeBtn) closeBtn.focus();
  }

  function openSearch() {
    beginOverlay();
    document.body.classList.add('lock-scroll', 'open-search');
    document.getElementById('searchModal').setAttribute('aria-hidden', 'false');
    const input = document.getElementById('searchInput');
    renderSearch(input.value || '');
    input.focus();
  }

  function openModal(wide) {
    beginOverlay();
    document.body.classList.add('lock-scroll', 'open-modal');
    const layer = document.getElementById('modalLayer');
    layer.classList.toggle('is-wide', !!wide);
    layer.setAttribute('aria-hidden', 'false');
    const closeBtn = layer.querySelector('[data-close]');
    if (closeBtn) closeBtn.focus();
  }

  function sizeGuideHTML() {
    return `
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>
      <p class="eyebrow">Fit</p>
      <h2 class="serif" style="font-size:2.4rem;margin:8px 0 10px">Size guide</h2>
      <p class="muted">Approximate body measurements in centimetres. If you are between sizes, choose the larger size for coats and blazers.</p>
      <table class="guide-table">
        <thead><tr><th>Size</th><th>Bust / chest</th><th>Waist</th><th>Hip</th></tr></thead>
        <tbody>
          <tr><td>XS</td><td>80</td><td>64</td><td>88</td></tr>
          <tr><td>S</td><td>86</td><td>70</td><td>94</td></tr>
          <tr><td>M</td><td>92</td><td>76</td><td>100</td></tr>
          <tr><td>L</td><td>98</td><td>82</td><td>106</td></tr>
          <tr><td>XL</td><td>106</td><td>90</td><td>114</td></tr>
        </tbody>
      </table>
      <p class="fine">These are body measurements, not garment measurements. Our tailoring is cut with ease through the shoulder.</p>`;
  }

  function openSizeGuide() {
    document.getElementById('modalCard').innerHTML = sizeGuideHTML();
    openModal(false);
  }

  const quick = { id: null, size: null, color: null, qty: 1 };

  function renderQuick() {
    const product = Aurel.Products.getById(quick.id);
    if (!product) return;
    const discount = Aurel.Products.discountOf(product);
    const sizes = product.sizes.map((size) => `<button type="button" data-pick-size="${Aurel.escapeHtml(size)}" class="${quick.size === size ? 'is-selected' : ''}">${Aurel.escapeHtml(size)}</button>`).join('');
    const colors = product.colors.map((color) => `
      <button type="button" class="color-option${quick.color === color ? ' is-selected' : ''}" data-pick-color="${Aurel.escapeHtml(color)}" aria-pressed="${quick.color === color}">
        <span class="swatch" style="background:${Aurel.Products.colorHex(color)}"></span>
        <span>${Aurel.escapeHtml(color)}</span>
      </button>`).join('');
    document.getElementById('modalCard').innerHTML = `
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>
      <div class="quick-grid">
        <img src="${product.images[0]}" alt="${Aurel.escapeHtml(product.name)}" referrerpolicy="no-referrer">
        <div>
          <p class="eyebrow">${Aurel.escapeHtml(product.category)} · ${Aurel.escapeHtml(product.subcategory)}</p>
          <h2 class="serif" style="font-size:2.4rem;margin:8px 0">${Aurel.escapeHtml(product.name)}</h2>
          <div class="card-meta">${Aurel.Products.starsHTML(product.rating)} <span>${product.rating.toFixed(1)} (${product.reviews})</span></div>
          <p class="price" style="margin:10px 0">
            <span class="price-now">${Aurel.Products.formatPrice(product.price)}</span>
            ${discount ? `<span class="price-was">${Aurel.Products.formatPrice(product.originalPrice)}</span>` : ''}
          </p>
          <p class="muted">${Aurel.escapeHtml(product.description)}</p>
          <div class="option-label"><span>Color</span><span data-color-label>${Aurel.escapeHtml(quick.color)}</span></div>
          <div class="color-picks">${colors}</div>
          <div class="option-label"><span>Size</span><button type="button" class="linkish js-size-guide">Size guide</button></div>
          <div class="size-options" id="quickSizes">${sizes}</div>
          <div class="option-label"><span>Quantity</span></div>
          <div class="qty">
            <button type="button" data-qty-dec aria-label="Decrease quantity">−</button>
            <span data-qty-val>${quick.qty}</span>
            <button type="button" data-qty-inc aria-label="Increase quantity">+</button>
          </div>
          <div class="buy-row">
            <button class="btn btn-solid" type="button" data-quick-add ${product.inStock ? '' : 'disabled'}>${product.inStock ? 'Add to cart' : 'Sold out'}</button>
            <a class="btn btn-ghost" href="product.html?id=${product.id}">View details</a>
          </div>
        </div>
      </div>`;
  }

  function openQuickView(id) {
    const product = Aurel.Products.getById(id);
    if (!product) return;
    quick.id = product.id;
    quick.size = null;
    quick.color = product.colors[0];
    quick.qty = 1;
    renderQuick();
    openModal(true);
  }

  function renderSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    const products = Aurel.Products.all();
    if (!products.length) {
      results.innerHTML = '<p class="muted">Loading the collection…</p>';
      Aurel.Products.load().then(() => renderSearch(query)).catch(() => {
        results.innerHTML = '<p>Search is unavailable right now.</p>';
      });
      return;
    }
    const q = query.trim().toLowerCase();
    let matches;
    let heading;
    if (!q) {
      matches = products.filter((product) => product.featured).slice(0, 5);
      heading = 'Featured pieces';
    } else {
      matches = products.filter((product) => {
        const haystack = [product.name, product.category, product.subcategory, product.description, ...product.colors].join(' ').toLowerCase();
        return haystack.includes(q);
      }).slice(0, 8);
      heading = matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}` : '';
    }
    searchIndex = -1;
    if (q && !matches.length) {
      results.innerHTML = `
        <div class="empty-state">
          <h2>No matches</h2>
          <p>Nothing in the atelier matches “${Aurel.escapeHtml(query.trim())}”.</p>
          <a class="btn btn-solid" href="shop.html">Browse the shop</a>
        </div>`;
      return;
    }
    const rows = matches.map((product, index) => `
      <a class="search-hit" href="product.html?id=${product.id}" data-search-index="${index}">
        <img src="${product.images[0]}" alt="" referrerpolicy="no-referrer">
        <span>
          <span class="eyebrow">${Aurel.escapeHtml(product.subcategory)}</span>
          <h3>${Aurel.escapeHtml(product.name)}</h3>
        </span>
        <strong>${Aurel.Products.formatPrice(product.price)}</strong>
      </a>`).join('');
    const more = q ? `<p style="margin-top:16px"><a class="text-link" href="shop.html?q=${encodeURIComponent(query.trim())}">View all results</a></p>` : '';
    results.innerHTML = `<p class="eyebrow" style="margin:8px 0">${heading}</p>${rows}${more}`;
  }

  function moveSearch(step) {
    const items = [...document.querySelectorAll('.search-hit')];
    if (!items.length) return;
    searchIndex = Math.max(0, Math.min(items.length - 1, searchIndex + step));
    items.forEach((item, index) => item.classList.toggle('is-active', index === searchIndex));
    items[searchIndex].scrollIntoView({ block: 'nearest' });
  }

  function updateCounts() {
    const cart = Aurel.Cart.count();
    const wishes = Aurel.Wishlist.get().length;
    ['cartCount'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(cart);
      el.hidden = cart <= 0;
    });
    const wish = document.getElementById('wishCount');
    if (wish) {
      wish.textContent = String(wishes);
      wish.hidden = wishes <= 0;
    }
  }

  function syncHearts() {
    document.querySelectorAll('[data-wish]').forEach((button) => {
      const on = Aurel.Wishlist.has(Number(button.dataset.wish));
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist');
      const label = button.querySelector('.wish-label');
      if (label) label.textContent = on ? 'Saved to wishlist' : 'Save to wishlist';
    });
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -32px 0px' });

  function reveal(scope) {
    (scope || document).querySelectorAll('.reveal').forEach((el) => {
      if (!el.classList.contains('is-visible')) revealObserver.observe(el);
    });
  }

  function setActiveNav() {
    const page = document.body.dataset.page;
    const params = new URLSearchParams(location.search);
    const gender = params.get('gender');
    const collection = params.get('collection');
    const state = {
      home: page === 'home',
      shop: page === 'shop' && !gender && !collection,
      men: page === 'shop' && !collection && gender === 'Men',
      women: page === 'shop' && !collection && gender === 'Women',
      new: page === 'shop' && collection === 'new',
      collections: page === 'shop' && collection === 'featured'
    };
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const on = !!state[link.dataset.nav];
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function bindChrome() {
    const toggle = document.getElementById('navToggle');
    const menu = document.getElementById('mobileMenu');
    if (menu) menu.setAttribute('aria-hidden', 'true');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        if (document.body.classList.contains('menu-open')) {
          closeOverlays();
          return;
        }
        beginOverlay();
        document.body.classList.add('lock-scroll', 'menu-open');
        toggle.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-hidden', 'false');
      });
    }

    document.getElementById('searchOpen').addEventListener('click', openSearch);
    document.getElementById('cartOpen').addEventListener('click', openCart);

    document.getElementById('backdrop').addEventListener('click', closeOverlays);
    document.getElementById('modalLayer').addEventListener('click', (event) => {
      if (event.target.id === 'modalLayer') closeOverlays();
    });

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => renderSearch(searchInput.value));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSearch(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSearch(-1);
      } else if (event.key === 'Enter') {
        const active = document.querySelector('.search-hit.is-active');
        if (active) {
          event.preventDefault();
          location.href = active.getAttribute('href');
        } else if (searchInput.value.trim()) {
          event.preventDefault();
          location.href = `shop.html?q=${encodeURIComponent(searchInput.value.trim())}`;
        }
      }
    });

    document.getElementById('modalCard').addEventListener('click', (event) => {
      const sizeBtn = event.target.closest('[data-pick-size]');
      if (sizeBtn) {
        quick.size = sizeBtn.dataset.pickSize;
        document.querySelectorAll('[data-pick-size]').forEach((button) => button.classList.toggle('is-selected', button === sizeBtn));
        return;
      }
      const colorBtn = event.target.closest('[data-pick-color]');
      if (colorBtn) {
        quick.color = colorBtn.dataset.pickColor;
        document.querySelectorAll('[data-pick-color]').forEach((button) => {
          const on = button === colorBtn;
          button.classList.toggle('is-selected', on);
          button.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const label = document.querySelector('[data-color-label]');
        if (label) label.textContent = quick.color;
        return;
      }
      if (event.target.closest('[data-qty-dec]')) {
        quick.qty = Math.max(1, quick.qty - 1);
        document.querySelector('[data-qty-val]').textContent = quick.qty;
        return;
      }
      if (event.target.closest('[data-qty-inc]')) {
        quick.qty = Math.min(8, quick.qty + 1);
        document.querySelector('[data-qty-val]').textContent = quick.qty;
        return;
      }
      if (event.target.closest('[data-quick-add]')) {
        if (!quick.size) {
          toast('Select a size to continue', 'error');
          return;
        }
        Aurel.Cart.add({ id: quick.id, size: quick.size, color: quick.color, qty: quick.qty });
        closeOverlays();
      }
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) closeOverlays();

      const wish = event.target.closest('[data-wish]');
      if (wish) {
        event.preventDefault();
        Aurel.Wishlist.toggle(Number(wish.dataset.wish));
        return;
      }
      const add = event.target.closest('[data-add]');
      if (add) {
        event.preventDefault();
        if (add.disabled) return;
        Aurel.Cart.add({ id: Number(add.dataset.add), qty: 1 });
        return;
      }
      const quickBtn = event.target.closest('[data-quick]');
      if (quickBtn) {
        event.preventDefault();
        openQuickView(Number(quickBtn.dataset.quick));
        return;
      }
      if (event.target.closest('.js-size-guide')) {
        event.preventDefault();
        openSizeGuide();
        return;
      }
      const qtyBtn = event.target.closest('[data-qty]');
      if (qtyBtn) {
        Aurel.Cart.update(qtyBtn.dataset.qty, Number(qtyBtn.dataset.dir));
        return;
      }
      const remove = event.target.closest('[data-remove]');
      if (remove) {
        Aurel.Cart.remove(remove.dataset.remove);
        return;
      }
      if (event.target.closest('[data-clear-promo]')) {
        const result = Aurel.Cart.applyPromo('');
        toast(result.message);
        return;
      }
      if (event.target.closest('[data-reload]')) location.reload();
    });

    document.addEventListener('change', (event) => {
      const sizeSelect = event.target.closest('[data-line-size]');
      if (sizeSelect) Aurel.Cart.changeOption(sizeSelect.dataset.lineSize, { size: sizeSelect.value });
      const colorSelect = event.target.closest('[data-line-color]');
      if (colorSelect) Aurel.Cart.changeOption(colorSelect.dataset.lineColor, { color: colorSelect.value });
    });

    document.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-promo-form]');
      if (!form) return;
      event.preventDefault();
      const result = Aurel.Cart.applyPromo(form.elements.code.value);
      toast(result.message, result.ok ? 'success' : 'error');
    });

    document.addEventListener('keydown', (event) => {
      const typing = event.target && (event.target.matches('input, textarea, select') || event.target.isContentEditable);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === 'Escape') {
        const lightbox = document.querySelector('.lightbox.is-open');
        if (lightbox) {
          lightbox.classList.remove('is-open');
          lightbox.setAttribute('aria-hidden', 'true');
          return;
        }
        if (overlaysOpen()) closeOverlays();
      }
    });

    document.addEventListener('error', (event) => {
      const image = event.target;
      if (!image || image.tagName !== 'IMG' || image.dataset.fallback) return;
      image.dataset.fallback = '1';
      image.src = 'assets/images/placeholder.svg';
    }, true);

    const header = document.getElementById('siteHeader');
    const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1025) document.body.classList.remove('open-filters');
      setInertFilters();
    });

    document.addEventListener('aurel:cart', () => {
      updateCounts();
      if (document.body.classList.contains('open-cart')) Aurel.Cart.renderDrawer();
    });
    document.addEventListener('aurel:wishlist', () => {
      updateCounts();
      syncHearts();
    });
  }

  function renderHomeRails() {
    const arrivals = document.getElementById('newGrid');
    const trending = document.getElementById('trendingGrid');
    if (!arrivals && !trending) return;
    Aurel.Products.load().then((products) => {
      const fresh = products.filter((product) => product.newArrival).slice(0, 8);
      const popular = [...products].sort((a, b) => (b.rating - a.rating) || (b.reviews - a.reviews)).slice(0, 8);
      if (arrivals) arrivals.innerHTML = fresh.map(Aurel.Products.cardHTML).join('');
      if (trending) trending.innerHTML = popular.map(Aurel.Products.cardHTML).join('');
      const section = document.getElementById('recentSection');
      const grid = document.getElementById('recentGrid');
      if (section && grid) {
        const recent = Aurel.Recent.products();
        section.hidden = recent.length === 0;
        grid.innerHTML = recent.map(Aurel.Products.cardHTML).join('');
      }
      reveal();
    }).catch(() => {
      const message = '<div class="empty-state"><h2>The collection is unavailable</h2><p>Refresh the page to try loading the edit again.</p><button class="btn btn-solid" type="button" data-reload>Try again</button></div>';
      if (arrivals) arrivals.innerHTML = message;
    });
  }

  function bindNewsletter() {
    const form = document.getElementById('newsletterForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.elements.email;
      const email = input.value.trim().toLowerCase();
      const existing = form.querySelector('.field-error');
      if (existing) existing.remove();
      input.removeAttribute('aria-invalid');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.setAttribute('aria-invalid', 'true');
        input.insertAdjacentHTML('afterend', '<p class="field-error" role="alert">Enter a valid email address.</p>');
        return;
      }
      const list = Aurel.storage.get('aurel_newsletter', []);
      if (list.includes(email)) {
        toast('This email is already on the list');
        return;
      }
      list.push(email);
      Aurel.storage.set('aurel_newsletter', list);
      form.reset();
      toast('You are on the list');
    });
  }

  ui.toast = toast;
  ui.reveal = reveal;
  ui.openQuickView = openQuickView;
  ui.openSizeGuide = openSizeGuide;
  ui.closeOverlays = closeOverlays;
  ui.prepareOverlay = beginOverlay;
  ui.setActiveNav = setActiveNav;
  ui.syncHearts = syncHearts;
  Aurel.ui = ui;

  portal();
  bindChrome();
  setActiveNav();
  updateCounts();
  syncHearts();
  reveal();
  setInertFilters();
  renderHomeRails();
  bindNewsletter();
})(window.Aurel = window.Aurel || {});
