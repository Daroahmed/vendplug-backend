// Lightweight cart badge injector/updater for any page with a cart icon
// Looks for links to buyer-vendor-checkout.html or buyer-agent-checkout.html
// Requires: window.BACKEND_URL and auth-utils.js (getAuthToken)

(function () {
  function injectStylesOnce() {
    if (document.getElementById('cart-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'cart-badge-styles';
    style.textContent = `
      .cart-icon { position: relative; }
      .cart-badge {
        position: absolute;
        top: -8px;
        right: -10px;
        background-color: var(--primary, #00cc99);
        color: #000;
        font-size: 0.7rem;
        font-weight: bold;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: none;
        align-items: center;
        justify-content: center;
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchCartCount(cartType) {
    try {
      // Token fallback for pages without auth-utils loaded
      const token = typeof getAuthToken === 'function'
        ? getAuthToken()
        : (localStorage.getItem('vendplug-buyer-token') || null);
      if (!token) return 0;

      // Prefer configured backend, else use relative API path
      const endpoint = cartType === 'agent' ? '/api/agent-cart' : '/api/vendor-cart';
      const base = window.BACKEND_URL || '';
      const url = base ? (base + endpoint) : endpoint;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      return items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    } catch (e) {
      return 0;
    }
  }

  function ensureBadge(anchorEl) {
    if (!anchorEl) return null;
    anchorEl.classList.add('cart-icon');
    // Prefer existing element with common classes/ids
    let badge = anchorEl.querySelector('.cart-badge, .cart-count, #cartCount, #cart-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge';
      badge.textContent = '0';
      anchorEl.appendChild(badge);
    } else if (!badge.classList.contains('cart-badge')) {
      // Harmonize styles for existing element
      badge.classList.add('cart-badge');
    }
    return badge;
  }

  async function updateBadges() {
    injectStylesOnce();

    const vendorAnchors = Array.from(document.querySelectorAll('a[href*="buyer-vendor-checkout"]'));
    const agentAnchors = Array.from(document.querySelectorAll('a[href*="buyer-agent-checkout"]'));

    const vendorBadgeTargets = vendorAnchors.map(ensureBadge).filter(Boolean);
    const agentBadgeTargets = agentAnchors.map(ensureBadge).filter(Boolean);

    // Fetch counts in parallel
    const [vendorCount, agentCount] = await Promise.all([
      vendorBadgeTargets.length ? fetchCartCount('vendor') : Promise.resolve(0),
      agentBadgeTargets.length ? fetchCartCount('agent') : Promise.resolve(0),
    ]);

    const apply = (elts, count) => {
      elts.forEach((b) => {
        if (!b) return;
        if (count > 0) {
          b.textContent = String(count);
          b.style.display = 'flex';
        } else {
          b.textContent = '0';
          b.style.display = 'none';
        }
      });
    };

    apply(vendorBadgeTargets, vendorCount);
    apply(agentBadgeTargets, agentCount);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Initial update
    updateBadges();
    // Refresh periodically to keep in sync with actions on other tabs/pages
    setInterval(updateBadges, 30000);
    // Update when storage changes (optional if some flows still use localStorage)
    window.addEventListener('storage', (e) => {
      if ((e.key || '').toLowerCase().includes('cart')) {
        updateBadges();
      }
    });
  });
})();


