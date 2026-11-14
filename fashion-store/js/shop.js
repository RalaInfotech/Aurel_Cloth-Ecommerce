/* Shop filters, sorting, and search. Every control reads and writes the URL. */
(function (Aurel) {
  'use strict';

  if (!document.body || document.body.dataset.page !== 'shop') return;

  const MAX_PRICE = 25000;
  const SORTS = ['featured', 'newest', 'price-asc', 'price-desc'];
  const GENDERS = ['Men', 'Women'];
  const CATEGORIES = ['Dresses', 'Blazers', 'Jackets', 'Shirts', 'T-Shirts', 'Jeans', 'Trousers', 'Hoodies', 'Casual'];
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const state = {
    genders: [],
    categories: [],
    sizes: [],
    colors: [],
    min: 0,
    max: MAX_PRICE,
    sort: 'featured',
    q: '',
    collection: ''
  };

  const els = {};

  function split(value) {
    if (!value) return [];
    return value.split(',').map((part) => part.trim()).filter(Boolean);
  }

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.genders = split(params.get('gender')).filter((item) => GENDERS.includes(item));
    state.categories = split(params.get('category'));
    state.sizes = split(params.get('size'));
    state.colors = split(params.get('color'));
    state.min = Math.max(0, Math.min(MAX_PRICE, numberOr(params.get('min'), 0)));
    state.max = params.has('max') ? Math.max(0, Math.min(MAX_PRICE, numberOr(params.get('max'), MAX_PRICE))) : MAX_PRICE;
    if (state.min > state.max) {
      const swap = state.min;
      state.min = state.max;
      state.max = swap;
    }
    state.sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'featured';
    state.q = params.get('q') || '';
    const collection = params.get('collection');
    state.collection = collection === 'new' || collection === 'featured' ? collection : '';
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.genders.length) params.set('gender', state.genders.join(','));
    if (state.categories.length) params.set('category', state.categories.join(','));
    if (state.sizes.length) params.set('size', state.sizes.join(','));
    if (state.colors.length) params.set('color', state.colors.join(','));
    if (state.min > 0) params.set('min', String(state.min));
    if (state.max < MAX_PRICE) params.set('max', String(state.max));
    if (state.sort !== 'featured') params.set('sort', state.sort);
    if (state.q) params.set('q', state.q);
    if (state.collection) params.set('collection', state.collection);
    const query = params.toString();
    history.replaceState(null, '', query ? `shop.html?${query}` : 'shop.html');
    if (Aurel.ui) Aurel.ui.setActiveNav();
  }

  function heading() {
    if (state.collection === 'new') return ['New arrivals', 'Just arrived. Limited runs from the current season.'];
    if (state.collection === 'featured') return ['Collections', 'The pieces we build the season around.'];
    if (state.genders.length === 1 && state.genders[0] === 'Men') return ['Men', 'Jackets, shirting, denim, and knitwear cut for a clean line.'];
    if (state.genders.length === 1 && state.genders[0] === 'Women') return ['Women', 'Dresses, tailoring, and everyday pieces with a precise fit.'];
    if (state.categories.length === 1) return [state.categories[0], `The current ${state.categories[0].toLowerCase()} edit.`];
    return ['Shop', 'Tailoring, dresses, denim, and knitwear — the full AUREL edit.'];
  }

  function apply(products) {
    const query = state.q.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (state.collection === 'new' && !product.newArrival) return false;
      if (state.collection === 'featured' && !product.featured) return false;
      if (state.genders.length && !state.genders.includes(product.category)) return false;
      if (state.categories.length && !state.categories.includes(product.subcategory)) return false;
      if (state.sizes.length && !product.sizes.some((size) => state.sizes.includes(size))) return false;
      if (state.colors.length && !product.colors.some((color) => state.colors.includes(color))) return false;
      if (product.price < state.min) return false;
      if (state.max < MAX_PRICE && product.price > state.max) return false;
      if (query) {
        const haystack = [product.name, product.category, product.subcategory, product.description, ...product.colors].join(' ').toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    if (state.sort === 'newest') filtered.sort((a, b) => b.id - a.id);
    else if (state.sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    else filtered.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating || b.id - a.id);
    return filtered;
  }

  function activeCount() {
    let count = state.genders.length + state.categories.length + state.sizes.length + state.colors.length;
    if (state.min > 0 || state.max < MAX_PRICE) count += 1;
    if (state.q) count += 1;
    return count;
  }

  function renderChips() {
    const host = els.chips;
    const items = [];
    state.genders.forEach((value) => items.push(['gender', value, value]));
    state.categories.forEach((value) => items.push(['category', value, value]));
    state.sizes.forEach((value) => items.push(['size', value, `Size ${value}`]));
    state.colors.forEach((value) => items.push(['color', value, value]));
    if (state.min > 0 || state.max < MAX_PRICE) {
      items.push(['price', '', `${Aurel.Products.formatPrice(state.min)} – ${state.max >= MAX_PRICE ? Aurel.Products.formatPrice(MAX_PRICE) : Aurel.Products.formatPrice(state.max)}`]);
    }
    if (state.q) items.push(['q', '', `“${state.q}”`]);
    host.innerHTML = items.map(([type, value, label]) => `
      <button class="chip" type="button" data-chip="${type}" data-value="${Aurel.escapeHtml(value)}">${Aurel.escapeHtml(label)} <span aria-hidden="true">×</span></button>`).join('');
  }

  function syncControls() {
    els.gender.querySelectorAll('input').forEach((input) => {
      input.checked = state.genders.includes(input.value);
    });
    els.category.querySelectorAll('input').forEach((input) => {
      input.checked = state.categories.includes(input.value);
    });
    els.size.querySelectorAll('button').forEach((button) => {
      const on = state.sizes.includes(button.dataset.size);
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    els.color.querySelectorAll('button').forEach((button) => {
      const on = state.colors.includes(button.dataset.color);
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    els.minRange.value = state.min;
    els.maxRange.value = state.max;
    els.minInput.value = state.min;
    els.maxInput.value = state.max === MAX_PRICE ? '' : state.max;
    els.readout.textContent = `${Aurel.Products.formatPrice(state.min)} – ${Aurel.Products.formatPrice(state.max >= MAX_PRICE ? MAX_PRICE : state.max)}`;
    if (els.search.value !== state.q) els.search.value = state.q;
    els.sort.value = state.sort;
    els.open.textContent = activeCount() ? `Filters (${activeCount()})` : 'Filters';
    const [title, intro] = heading();
    els.title.textContent = title;
    els.intro.textContent = intro;
    document.title = `${title} — AUREL`;
  }

  function renderProducts() {
    const products = apply(Aurel.Products.all());
    els.count.textContent = products.length === 1 ? '1 piece' : `${products.length} pieces`;
    els.empty.hidden = products.length !== 0;
    els.grid.hidden = products.length === 0;
    els.grid.setAttribute('aria-busy', 'false');
    els.grid.innerHTML = products.map(Aurel.Products.cardHTML).join('');
    renderChips();
    if (Aurel.ui) Aurel.ui.syncHearts();
  }

  function commit() {
    writeUrl();
    syncControls();
    renderProducts();
  }

  function clearFacets() {
    state.genders = [];
    state.categories = [];
    state.sizes = [];
    state.colors = [];
    state.min = 0;
    state.max = MAX_PRICE;
    state.q = '';
    commit();
  }

  function checkedValues(container) {
    return [...container.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function buildFilters(products) {
    const categories = CATEGORIES.filter((name) => products.some((product) => product.subcategory === name));
    products.forEach((product) => {
      if (!categories.includes(product.subcategory)) categories.push(product.subcategory);
    });
    const sizes = SIZES.filter((size) => products.some((product) => product.sizes.includes(size)));
    const colors = [...new Set(products.flatMap((product) => product.colors))].sort();

    els.gender.innerHTML = GENDERS.map((gender) => `
      <label class="check"><input type="checkbox" value="${gender}"> <span>${gender}</span></label>`).join('');
    els.category.innerHTML = categories.map((category) => `
      <label class="check"><input type="checkbox" value="${Aurel.escapeHtml(category)}"> <span>${Aurel.escapeHtml(category)}</span></label>`).join('');
    els.size.innerHTML = sizes.map((size) => `
      <button type="button" data-size="${size}" aria-pressed="false">${size}</button>`).join('');
    els.color.innerHTML = colors.map((color) => `
      <button type="button" class="color-filter" data-color="${Aurel.escapeHtml(color)}" aria-pressed="false">
        <span class="swatch" style="background:${Aurel.Products.colorHex(color)}"></span>
        <span>${Aurel.escapeHtml(color)}</span>
      </button>`).join('');

    els.gender.addEventListener('change', () => {
      state.genders = checkedValues(els.gender);
      commit();
    });
    els.category.addEventListener('change', () => {
      state.categories = checkedValues(els.category);
      commit();
    });
    els.size.addEventListener('click', (event) => {
      const button = event.target.closest('[data-size]');
      if (!button) return;
      const size = button.dataset.size;
      state.sizes = state.sizes.includes(size)
        ? state.sizes.filter((item) => item !== size)
        : [...state.sizes, size];
      commit();
    });
    els.color.addEventListener('click', (event) => {
      const button = event.target.closest('[data-color]');
      if (!button) return;
      const color = button.dataset.color;
      state.colors = state.colors.includes(color)
        ? state.colors.filter((item) => item !== color)
        : [...state.colors, color];
      commit();
    });
  }

  function clampPrice() {
    state.min = Math.max(0, Math.min(MAX_PRICE, state.min));
    state.max = Math.max(0, Math.min(MAX_PRICE, state.max));
    if (state.min > state.max) state.max = state.min;
  }

  function bindPrice() {
    const applyRange = () => {
      clampPrice();
      commit();
    };
    els.minRange.addEventListener('input', () => {
      state.min = Number(els.minRange.value);
      if (state.min > state.max) state.max = state.min;
      syncControls();
    });
    els.maxRange.addEventListener('input', () => {
      state.max = Number(els.maxRange.value);
      if (state.max < state.min) state.min = state.max;
      syncControls();
    });
    els.minRange.addEventListener('change', applyRange);
    els.maxRange.addEventListener('change', applyRange);
    els.minInput.addEventListener('change', () => {
      state.min = numberOr(els.minInput.value, 0);
      clampPrice();
      commit();
    });
    els.maxInput.addEventListener('change', () => {
      state.max = els.maxInput.value === '' ? MAX_PRICE : numberOr(els.maxInput.value, MAX_PRICE);
      clampPrice();
      commit();
    });
  }

  function bindToolbar() {
    let timer = 0;
    els.search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = els.search.value.trim();
        commit();
      }, 220);
    });
    els.sort.addEventListener('change', () => {
      state.sort = els.sort.value;
      commit();
    });
    els.open.addEventListener('click', () => {
      if (Aurel.ui) Aurel.ui.prepareOverlay();
      document.body.classList.add('lock-scroll', 'open-filters');
      document.getElementById('backdrop').classList.add('is-on');
      document.getElementById('filters').removeAttribute('inert');
      const close = document.getElementById('closeFilters');
      if (close) close.focus();
    });
    els.close.addEventListener('click', () => {
      if (Aurel.ui) Aurel.ui.closeOverlays();
    });
    els.clear.addEventListener('click', clearFacets);
    els.emptyClear.addEventListener('click', clearFacets);
    els.chips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-chip]');
      if (!chip) return;
      const type = chip.dataset.chip;
      const value = chip.dataset.value;
      if (type === 'gender') state.genders = state.genders.filter((item) => item !== value);
      if (type === 'category') state.categories = state.categories.filter((item) => item !== value);
      if (type === 'size') state.sizes = state.sizes.filter((item) => item !== value);
      if (type === 'color') state.colors = state.colors.filter((item) => item !== value);
      if (type === 'price') {
        state.min = 0;
        state.max = MAX_PRICE;
      }
      if (type === 'q') state.q = '';
      commit();
    });
  }

  function cacheElements() {
    els.title = document.getElementById('shopTitle');
    els.intro = document.getElementById('shopIntro');
    els.count = document.getElementById('productCount');
    els.grid = document.getElementById('productGrid');
    els.empty = document.getElementById('shopEmpty');
    els.sort = document.getElementById('sortSelect');
    els.search = document.getElementById('shopSearch');
    els.open = document.getElementById('openFilters');
    els.close = document.getElementById('closeFilters');
    els.clear = document.getElementById('clearFilters');
    els.emptyClear = document.getElementById('emptyClear');
    els.gender = document.getElementById('filterGender');
    els.category = document.getElementById('filterCategory');
    els.size = document.getElementById('filterSize');
    els.color = document.getElementById('filterColor');
    els.minRange = document.getElementById('priceMin');
    els.maxRange = document.getElementById('priceMax');
    els.minInput = document.getElementById('priceMinInput');
    els.maxInput = document.getElementById('priceMaxInput');
    els.readout = document.getElementById('priceReadout');
    els.chips = document.getElementById('activeFilters');
  }

  cacheElements();
  readUrl();
  els.grid.innerHTML = Aurel.Products.skeletonCards(6);
  els.grid.setAttribute('aria-busy', 'true');

  Aurel.Products.load().then((products) => {
    buildFilters(products);
    bindPrice();
    bindToolbar();
    commit();
  }).catch(() => {
    els.grid.innerHTML = '<div class="empty-state"><h2>The collection is unavailable</h2><p>Refresh the page to try again.</p><button class="btn btn-solid" type="button" data-reload>Try again</button></div>';
  });
})(window.Aurel = window.Aurel || {});
