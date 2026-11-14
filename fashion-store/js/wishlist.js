/* Wishlist stored on this device. Hearts and the wishlist page read the same list. */
(function (Aurel) {
  'use strict';

  const KEY = 'aurel_wishlist';

  function emit() {
    document.dispatchEvent(new CustomEvent('aurel:wishlist'));
  }

  function get() {
    const list = Aurel.storage.get(KEY, []);
    return Array.isArray(list) ? list.map(Number).filter(Boolean) : [];
  }

  function has(id) {
    return get().includes(Number(id));
  }

  function toggle(id) {
    const numeric = Number(id);
    const current = get();
    const exists = current.includes(numeric);
    const next = exists ? current.filter((item) => item !== numeric) : [numeric, ...current];
    Aurel.storage.set(KEY, next);
    const product = Aurel.Products.getById(numeric);
    const name = product ? product.name : 'Piece';
    if (Aurel.ui) {
      Aurel.ui.toast(exists ? `Removed from wishlist — ${name}` : `Added to wishlist — ${name}`);
    }
    emit();
    return !exists;
  }

  function renderPage() {
    const grid = document.getElementById('wishlistGrid');
    const empty = document.getElementById('wishlistEmpty');
    const count = document.getElementById('wishlistCount');
    if (!grid || !empty) return;
    const paint = () => {
      const products = get().map((id) => Aurel.Products.getById(id)).filter(Boolean);
      if (count) count.textContent = products.length === 1 ? '1 piece saved' : `${products.length} pieces saved`;
      if (!products.length) {
        grid.innerHTML = '';
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      grid.innerHTML = products.map(Aurel.Products.cardHTML).join('');
      if (Aurel.ui) Aurel.ui.reveal(grid);
    };
    if (!Aurel.Products.ready()) {
      Aurel.Products.load().then(paint).catch(() => {
        grid.innerHTML = '';
        empty.hidden = false;
        empty.querySelector('p').textContent = 'The collection could not be loaded.';
      });
      return;
    }
    paint();
  }

  Aurel.Wishlist = { get, has, toggle, renderPage };

  if (document.body && document.body.dataset.page === 'wishlist') {
    renderPage();
    document.addEventListener('aurel:wishlist', renderPage);
  }
})(window.Aurel = window.Aurel || {});
