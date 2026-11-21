/* Studio: edit the catalog stored in this browser. Sign-in is required first. */
(function (Aurel) {
  'use strict';

  const LOW = 5;
  const MAX_IMAGES = 3;
  let draftImages = [];
  const SESSION = 'aurel_studio_session';
  const USER = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
  const PASS = '339c8783dabb7611ad27703d9587b3d61e8d80d9eee0824bd443247492aee803';
  let failures = 0;
  let lockedUntil = 0;
  let products = [];
  let editingId = null;

  const panels = {
    overview: document.getElementById('view-overview'),
    products: document.getElementById('view-products'),
    stock: document.getElementById('view-stock'),
    orders: document.getElementById('view-orders')
  };

  function toast(message) {
    const host = document.getElementById('studioToast');
    const note = document.createElement('div');
    note.className = 'toast show';
    note.textContent = message;
    host.appendChild(note);
    window.setTimeout(() => note.remove(), 2800);
  }

  function money(value) {
    return Aurel.Products.formatPrice(value);
  }

  function statusOf(product) {
    if (product.stock <= 0) return { key: 'out', label: 'Sold out' };
    if (product.stock <= LOW) return { key: 'low', label: 'Low' };
    return { key: 'in', label: 'In stock' };
  }

  function listFrom(value) {
    return String(value || '')
      .split(/[,|\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function showStock(mode) {
    document.getElementById('productSearch').value = '';
    document.getElementById('productFilter').value = mode;
    showView('products');
    document.getElementById('view-products').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showView(name) {
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== name;
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const on = button.dataset.view === name;
      button.classList.toggle('is-active', on);
      if (on) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (name === 'products') renderProducts();
    if (name === 'stock') renderStock();
    if (name === 'orders') renderOrders();
    if (name === 'overview') renderOverview();
  }

  function renderOverview() {
    const units = products.reduce((sum, product) => sum + product.stock, 0);
    const soldOut = products.filter((product) => product.stock <= 0);
    const low = products.filter((product) => product.stock > 0 && product.stock <= LOW);
    const letters = Aurel.storage.get('aurel_newsletter', []);
    const stats = [
      ['Products', products.length],
      ['Units on hand', units],
      ['Low stock', low.length, 'low'],
      ['Sold out', soldOut.length, 'out']
    ];
    document.getElementById('statGrid').innerHTML = stats.map(([label, value, mode]) => {
      const clickable = Boolean(mode);
      const tone = clickable && value > 0 ? (mode === 'low' ? ' is-low' : ' is-out') : '';
      return `
      <${clickable ? 'button type="button"' : 'article'} class="stat${tone}"${clickable ? ` data-show-stock="${mode}"` : ''}>
        <p class="eyebrow">${label}</p>
        <strong>${value}</strong>
      </${clickable ? 'button' : 'article'}>`;
    }).join('');
    const badge = document.getElementById('lowBadge');
    if (badge) {
      badge.hidden = low.length === 0;
      badge.textContent = String(low.length);
    }

    const attention = low.concat(soldOut);
    document.getElementById('attentionList').innerHTML = attention.length
      ? `<ul class="plain-list">${attention.map((product) => `<li><button type="button" data-edit="${product.id}">${Aurel.escapeHtml(product.name)}</button><span>${product.stock}</span></li>`).join('')}</ul>`
      : '<p class="muted">Every piece has a comfortable stock.</p>';

    const saved = Array.isArray(letters) ? letters : [];
    document.getElementById('letterList').innerHTML = saved.length
      ? `<ul class="plain-list">${saved.map((email) => `<li><span>${Aurel.escapeHtml(email)}</span></li>`).join('')}</ul>`
      : '<p class="muted">No newsletter addresses on this device yet.</p>';
  }

  function filteredProducts() {
    const query = document.getElementById('productSearch').value.trim().toLowerCase();
    const mode = document.getElementById('productFilter').value;
    return products.filter((product) => {
      const status = statusOf(product).key;
      if (mode !== 'all' && status !== mode) return false;
      if (!query) return true;
      const haystack = [product.name, product.category, product.subcategory, product.description].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderProducts() {
    const rows = filteredProducts();
    const mode = document.getElementById('productFilter').value;
    const countCopy = {
      low: `${rows.length} ${rows.length === 1 ? 'piece is' : 'pieces are'} low on stock`,
      out: `${rows.length} ${rows.length === 1 ? 'piece is' : 'pieces are'} sold out`
    };
    document.getElementById('productCount').textContent = countCopy[mode] || `${rows.length} ${rows.length === 1 ? 'piece' : 'pieces'}`;
    const empty = document.getElementById('productEmpty');
    empty.hidden = rows.length > 0;
    empty.textContent = mode === 'low'
      ? 'No pieces are low on stock.'
      : mode === 'out'
        ? 'No pieces are sold out.'
        : 'No pieces match this search.';
    document.getElementById('productRows').innerHTML = rows.map((product) => {
      const status = statusOf(product);
      const image = (product.images && product.images[0]) || 'assets/images/placeholder.svg';
      return `
        <tr>
          <td>
            <div class="piece-cell">
              <img src="${Aurel.escapeHtml(image)}" alt="" referrerpolicy="no-referrer">
              <div>
                <strong>${Aurel.escapeHtml(product.name)}</strong>
                <span>${product.featured ? 'Featured' : ''}${product.featured && product.newArrival ? ' · ' : ''}${product.newArrival ? 'New' : ''}</span>
              </div>
            </div>
          </td>
          <td>${Aurel.escapeHtml(product.category)} · ${Aurel.escapeHtml(product.subcategory)}</td>
          <td>${money(product.price)}</td>
          <td><span class="pill pill-${status.key}">${status.label} · ${product.stock}</span></td>
          <td class="row-actions"><button type="button" data-edit="${product.id}">Edit</button></td>
        </tr>`;
    }).join('');
  }

  function renderStock() {
    document.getElementById('stockRows').innerHTML = products.map((product) => {
      const status = statusOf(product);
      return `
        <tr>
          <td>
            <strong>${Aurel.escapeHtml(product.name)}</strong>
            <span class="cell-sub">${Aurel.escapeHtml(product.category)} · ${Aurel.escapeHtml(product.subcategory)}</span>
          </td>
          <td><span class="pill pill-${status.key}">${status.label}</span></td>
          <td>
            <div class="stock-stepper">
              <button type="button" data-stock-step="${product.id}" data-dir="-1" aria-label="Decrease stock for ${Aurel.escapeHtml(product.name)}">−</button>
              <input type="number" min="0" max="999" value="${product.stock}" data-stock="${product.id}" aria-label="Stock for ${Aurel.escapeHtml(product.name)}">
              <button type="button" data-stock-step="${product.id}" data-dir="1" aria-label="Increase stock for ${Aurel.escapeHtml(product.name)}">+</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  function renderOrders() {
    const orders = Aurel.Products.orders();
    const host = document.getElementById('orderList');
    if (!orders.length) {
      host.innerHTML = '<div class="empty-state"><h2>No orders yet</h2><p>When someone places an order in this browser, it will be listed here and the stock will fall.</p></div>';
      return;
    }
    host.innerHTML = orders.map((order) => {
      const when = new Date(order.placedAt);
      const date = Number.isNaN(when.getTime()) ? '' : when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      const items = (order.items || []).map((item) => `<li>${Aurel.escapeHtml(item.name)} · ${Aurel.escapeHtml(item.color || '')} / ${Aurel.escapeHtml(item.size || '')} × ${item.qty}</li>`).join('');
      return `
        <article class="order-card">
          <header>
            <div>
              <p class="eyebrow">${Aurel.escapeHtml(order.id || '')}</p>
              <h2>${Aurel.escapeHtml(order.name || 'Client')}</h2>
            </div>
            <strong>${money(order.total)}</strong>
          </header>
          <p class="fine">${Aurel.escapeHtml(date)} · ${Aurel.escapeHtml(order.method || '')} · ${Aurel.escapeHtml(order.email || '')}</p>
          <ul>${items}</ul>
        </article>`;
    }).join('');
  }

  function setStock(id, stock) {
    const product = products.find((item) => item.id === Number(id));
    if (!product) return;
    const next = Math.max(0, Math.min(999, Math.round(Number(stock) || 0)));
    try {
      Aurel.Products.replaceProduct(Object.assign({}, product, { stock: next }));
      products = Aurel.Products.all();
      const updated = products.find((item) => item.id === Number(id));
      const status = updated ? statusOf(updated) : null;
      if (status && status.key === 'low') toast(`${product.name} is low on stock`);
      else if (next === 0) toast(`${product.name} is sold out`);
      else toast(`${product.name} stock is ${next}`);
      renderStock();
      renderProducts();
      renderOverview();
    } catch (err) {
      toast(err.message);
    }
  }

  function renderPreviews() {
    const host = document.getElementById('imagePreviews');
    if (!draftImages.length) {
      host.innerHTML = '<p class="fine">No photo yet. A placeholder is used until you upload one.</p>';
      return;
    }
    const labels = ['Main', 'Hover', 'Gallery'];
    host.innerHTML = draftImages.map((src, index) => `
      <figure>
        <img src="${src}" alt="">
        <figcaption>${labels[index] || 'Photo'}</figcaption>
        <button type="button" data-remove-image="${index}" aria-label="Remove ${labels[index] || 'photo'}">×</button>
      </figure>`).join('');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('That photo could not be read.'));
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const longest = Math.max(image.width, image.height);
          const scale = Math.min(1, 1100 / longest);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.onerror = () => reject(new Error('That file is not a usable photo.'));
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addImages(sources) {
    const room = MAX_IMAGES - draftImages.length;
    if (room <= 0) {
      toast('Three photos is the maximum');
      return;
    }
    draftImages = draftImages.concat(sources.slice(0, room));
    if (sources.length > room) toast('Only the first 3 photos are kept');
    renderPreviews();
  }

  function openEditor(product) {
    const form = document.getElementById('editorForm');
    editingId = product && product.id ? product.id : null;
    document.getElementById('editorTitle').textContent = editingId ? 'Edit piece' : 'New piece';
    document.getElementById('editorEyebrow').textContent = editingId ? `No. ${editingId}` : 'New';
    document.getElementById('deleteProduct').hidden = !editingId;
    document.getElementById('editorError').hidden = true;
    form.elements.name.value = product ? product.name : '';
    form.elements.category.value = product && product.category === 'Men' ? 'Men' : 'Women';
    form.elements.subcategory.value = product ? product.subcategory : '';
    form.elements.stock.value = product ? product.stock : 10;
    form.elements.price.value = product ? product.price : 4999;
    form.elements.originalPrice.value = product ? product.originalPrice : 4999;
    form.elements.rating.value = product ? product.rating : 5;
    form.elements.reviews.value = product ? product.reviews : 0;
    form.elements.colors.value = product ? (product.colors || []).join(', ') : '';
    form.elements.sizes.value = product ? (product.sizes || []).join(', ') : 'S, M, L';
    draftImages = product
      ? (product.images || []).filter((src) => src && !src.endsWith('placeholder.svg')).slice(0, MAX_IMAGES)
      : [];
    renderPreviews();
    document.getElementById('imageFiles').value = '';
    document.getElementById('imageLink').value = '';
    form.elements.description.value = product ? product.description : '';
    form.elements.featured.checked = !!(product && product.featured);
    form.elements.newArrival.checked = product ? !!product.newArrival : true;
    document.getElementById('editorLayer').hidden = false;
    document.body.classList.add('lock-scroll');
    form.elements.name.focus();
  }

  function closeEditor() {
    document.getElementById('editorLayer').hidden = true;
    document.body.classList.remove('lock-scroll');
    editingId = null;
  }

  function readProduct(form) {
    const price = Math.round(Number(form.elements.price.value));
    const originalPrice = Math.round(Number(form.elements.originalPrice.value));
    const colors = listFrom(form.elements.colors.value);
    const sizes = listFrom(form.elements.sizes.value);
    const images = draftImages.slice(0, MAX_IMAGES);
    const name = form.elements.name.value.trim();
    const subcategory = form.elements.subcategory.value.trim();
    const description = form.elements.description.value.trim();
    if (!name || !subcategory || !description) return 'Name, type, and description are required.';
    if (!colors.length || !sizes.length) return 'Add at least one colour and one size.';
    if (!(price > 0) || !(originalPrice > 0)) return 'Enter prices above zero.';
    if (originalPrice < price) return 'The original price cannot be lower than the selling price.';
    const stock = Math.max(0, Math.round(Number(form.elements.stock.value) || 0));
    return {
      id: editingId || Aurel.Products.nextId(),
      name,
      category: form.elements.category.value === 'Men' ? 'Men' : 'Women',
      subcategory,
      price,
      originalPrice,
      discount: originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0,
      rating: Math.min(5, Math.max(0, Number(form.elements.rating.value) || 0)),
      reviews: Math.max(0, Math.round(Number(form.elements.reviews.value) || 0)),
      colors,
      sizes,
      images: images.length ? images : ['assets/images/placeholder.svg'],
      description,
      featured: form.elements.featured.checked,
      newArrival: form.elements.newArrival.checked,
      stock,
      inStock: stock > 0
    };
  }

  function bind() {
    document.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.view === 'products') {
          document.getElementById('productSearch').value = '';
          document.getElementById('productFilter').value = 'all';
        }
        showView(button.dataset.view);
      });
    });

    document.getElementById('statGrid').addEventListener('click', (event) => {
      const card = event.target.closest('[data-show-stock]');
      if (card) showStock(card.dataset.showStock);
    });

    document.getElementById('lowBadge').addEventListener('click', (event) => {
      event.stopPropagation();
      showStock('low');
    });

    document.getElementById('addProduct').addEventListener('click', () => openEditor(null));
    document.getElementById('editorLayer').addEventListener('click', (event) => {
      if (event.target.id === 'editorLayer') closeEditor();
    });
    document.querySelector('[data-close-editor]').addEventListener('click', closeEditor);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !document.getElementById('editorLayer').hidden) closeEditor();
    });

    document.getElementById('productSearch').addEventListener('input', renderProducts);
    document.getElementById('productFilter').addEventListener('change', renderProducts);

    document.getElementById('imageFiles').addEventListener('change', (event) => {
      const files = [...event.target.files];
      event.target.value = '';
      if (!files.length) return;
      Promise.all(files.map(fileToDataUrl)).then((urls) => {
        addImages(urls);
      }).catch((err) => {
        toast(err.message || 'That photo could not be added');
      });
    });

    document.getElementById('addImageLink').addEventListener('click', () => {
      const input = document.getElementById('imageLink');
      const link = input.value.trim();
      if (!link) return;
      addImages([link]);
      input.value = '';
    });

    document.getElementById('editorForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = readProduct(event.currentTarget);
      const error = document.getElementById('editorError');
      if (typeof result === 'string') {
        error.hidden = false;
        error.textContent = result;
        return;
      }
      try {
        Aurel.Products.replaceProduct(result);
        products = Aurel.Products.all();
        closeEditor();
        renderProducts();
        renderOverview();
        toast('Piece saved');
      } catch (err) {
        error.hidden = false;
        error.textContent = err.name === 'QuotaExceededError'
          ? 'These photos are too large to save in this browser. Remove one and try again.'
          : err.message;
      }
    });

    document.getElementById('deleteProduct').addEventListener('click', () => {
      if (!editingId) return;
      const product = products.find((item) => item.id === editingId);
      if (!product) return;
      if (!window.confirm(`Remove ${product.name} from the collection?`)) return;
      try {
        Aurel.Products.removeProduct(editingId);
        products = Aurel.Products.all();
        closeEditor();
        renderProducts();
        renderOverview();
        toast('Piece removed');
      } catch (err) {
        toast(err.message);
      }
    });

    document.body.addEventListener('click', (event) => {
      const removeImage = event.target.closest('[data-remove-image]');
      if (removeImage) {
        draftImages.splice(Number(removeImage.dataset.removeImage), 1);
        renderPreviews();
        return;
      }
      const edit = event.target.closest('[data-edit]');
      if (edit) {
        const product = products.find((item) => item.id === Number(edit.dataset.edit));
        if (product) openEditor(product);
        return;
      }
      const step = event.target.closest('[data-stock-step]');
      if (step) {
        const product = products.find((item) => item.id === Number(step.dataset.stockStep));
        if (product) setStock(product.id, product.stock + Number(step.dataset.dir));
      }
    });

    document.body.addEventListener('change', (event) => {
      const input = event.target.closest('[data-stock]');
      if (!input) return;
      setStock(input.dataset.stock, input.value);
    });

    document.getElementById('resetCatalog').addEventListener('click', () => {
      if (!window.confirm('Restore the original collection? Studio edits on this device will be cleared.')) return;
      Aurel.Products.resetCatalog().then(() => {
        products = Aurel.Products.all();
        renderOverview();
        toast('Original collection restored');
      });
    });
  }

  function sha256(ascii) {
    function rotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const maxWord = 2 ** 32;
    const words = [];
    const hash = [];
    const k = [];
    const composite = {};
    let primes = 0;
    for (let candidate = 2; primes < 64; candidate += 1) {
      if (composite[candidate]) continue;
      for (let i = 0; i < 313; i += candidate) composite[i] = candidate;
      hash[primes] = (candidate ** 0.5 * maxWord) | 0;
      k[primes] = ((candidate ** (1 / 3)) * maxWord) | 0;
      primes += 1;
    }
    let text = unescape(encodeURIComponent(ascii)) + '\x80';
    const bitLength = (text.length - 1) * 8;
    while ((text.length % 64) !== 56) text += '\x00';
    for (let i = 0; i < text.length; i += 1) {
      words[i >> 2] |= text.charCodeAt(i) << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLength / maxWord) | 0;
    words[words.length] = bitLength;
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16);
      const old = hash.slice(0);
      for (let i = 0; i < 64; i += 1) {
        const w15 = w[i - 15];
        const w2 = w[i - 2];
        const a = hash[0];
        const e = hash[4];
        const temp1 = (hash[7]
          + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = i < 16 ? w[i] : (w[i - 16]
            + (rotate(w15, 7) ^ rotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rotate(w2, 17) ^ rotate(w2, 19) ^ (w2 >>> 10))) | 0)) | 0;
        const temp2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))) | 0;
        hash.unshift((temp1 + temp2) | 0);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (let i = 0; i < 8; i += 1) hash[i] = (hash[i] + old[i]) | 0;
    }
    return hash.slice(0, 8).map((value) => (`00000000${(value >>> 0).toString(16)}`).slice(-8)).join('');
  }

  function signedIn() {
    return sessionStorage.getItem(SESSION) === '1' || localStorage.getItem(SESSION) === '1';
  }

  function openStudio() {
    document.body.classList.remove('studio-locked');
    document.getElementById('loginScreen').hidden = true;
    document.getElementById('studioBar').hidden = false;
    document.getElementById('studioMain').hidden = false;
    document.querySelector('.skip-link').setAttribute('href', '#studioMain');
    Aurel.Products.load().then((list) => {
      products = list;
      bind();
      const requested = new URLSearchParams(location.search).get('view');
      showView(panels[requested] ? requested : 'overview');
    }).catch(() => {
      document.getElementById('studioMain').innerHTML = '<div class="empty-state"><h1>The collection could not be opened</h1><p>Refresh Studio and try again.</p></div>';
    });
  }

  function bindLogin() {
    const form = document.getElementById('loginForm');
    const error = document.getElementById('loginError');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (Date.now() < lockedUntil) {
        error.hidden = false;
        error.textContent = 'Too many attempts. Wait a moment and try again.';
        return;
      }
      const username = form.elements.username.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const match = sha256(username) === USER && sha256(password) === PASS;
      if (!match) {
        failures += 1;
        error.hidden = false;
        error.textContent = 'That username or password is not recognised.';
        if (failures >= 5) {
          lockedUntil = Date.now() + 20000;
          failures = 0;
          error.textContent = 'Too many attempts. Wait a moment and try again.';
        }
        return;
      }
      sessionStorage.setItem(SESSION, '1');
      if (form.elements.remember.checked) localStorage.setItem(SESSION, '1');
      else localStorage.removeItem(SESSION);
      openStudio();
    });
  }

  document.getElementById('signOut').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION);
    localStorage.removeItem(SESSION);
    location.reload();
  });

  window.addEventListener('focus', () => {
    if (!signedIn() || !Aurel.Products.ready()) return;
    Aurel.Products.reload().then((list) => {
      products = list;
      renderOverview();
      if (!panels.stock.hidden) renderStock();
      if (!panels.products.hidden) renderProducts();
      if (!panels.orders.hidden) renderOrders();
    });
  });

  if (signedIn()) openStudio();
  else bindLogin();
})(window.Aurel = window.Aurel || {});
