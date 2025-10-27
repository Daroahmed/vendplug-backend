// frontend/js/buyer-agent-checkout.js
document.addEventListener('DOMContentLoaded', async () => {
  // =========================
  // DOM ELEMENTS
  // =========================
  const cartContainer = document.getElementById('cart-items');
  const totalEl = document.getElementById('total-amount');
  const walletEl = document.getElementById('wallet-balance');
  const checkoutBtn = document.getElementById('checkout-btn');
  const stateInput = document.getElementById('pickup-state');
  const addressInput = document.getElementById('pickup-address');

  // =========================
  // CONFIG & STATE
  // =========================
  const baseURL = window.BACKEND_URL; // ✅ from config.js

  if (!baseURL) {
    console.error("❌ BACKEND_URL is not defined. Check config.js load order.");
    window.showOverlay && showOverlay({ type:'error', title:'Configuration', message:'BACKEND_URL not set.' });
    return;
  }

  // =========================
  // TOKEN VALIDATION & REFRESH
  // =========================
  let token = getAuthToken();
  
  if (!token) {
    window.showOverlay && showOverlay({ type:'error', title:'Login required', message:'Please login first' });
    redirectToLogin();
    return;
  }

  // Validate and refresh token on page load
  try {
    const response = await fetch(`${baseURL}/api/auth/validate`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      // Try to refresh token
      const refreshResponse = await fetch(`${baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.token) {
          // Update token in localStorage
          const userType = getCurrentUserType();
          const tokenKey = userType ? `vendplug-${userType}-token` : 'vendplug-token';
          localStorage.setItem(tokenKey, refreshData.token);
          token = refreshData.token;
          console.log('✅ Token refreshed successfully');
        } else {
          throw new Error('No new token received');
        }
      } else {
        throw new Error('Token refresh failed');
      }
    }
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    window.showOverlay && showOverlay({ 
      type: 'error', 
      title: 'Session Expired', 
      message: 'Please login again to continue' 
    });
    setTimeout(() => redirectToLogin(), 2000);
    return;
  }

  let cart = [];
  let walletBalance = 0;

  // =========================
  // AUTHENTICATED REQUEST HELPER
  // =========================
  async function makeAuthenticatedRequest(url, options = {}) {
    const currentToken = getAuthToken();
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${currentToken}`
      }
    };

    try {
      const response = await fetch(url, requestOptions);
      
      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshResponse = await fetch(`${baseURL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: currentToken })
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.token) {
            // Update token and retry request
            const userType = getCurrentUserType();
            const tokenKey = userType ? `vendplug-${userType}-token` : 'vendplug-token';
            localStorage.setItem(tokenKey, refreshData.token);
            
            // Retry with new token
            const retryOptions = {
              ...requestOptions,
              headers: {
                ...requestOptions.headers,
                Authorization: `Bearer ${refreshData.token}`
              }
            };
            return await fetch(url, retryOptions);
          }
        }
        
        // Refresh failed, redirect to login
        window.showOverlay && showOverlay({ 
          type: 'error', 
          title: 'Session Expired', 
          message: 'Please login again to continue' 
        });
        setTimeout(() => redirectToLogin(), 2000);
        throw new Error('Authentication failed');
      }
      
      return response;
    } catch (error) {
      console.error('❌ Authenticated request failed:', error);
      throw error;
    }
  }

  // =========================
  // LOAD CART + WALLET
  // =========================
  async function loadCart() {
    try {
      showLoading && showLoading();
      const [cartRes, walletRes] = await Promise.all([
        makeAuthenticatedRequest(`${baseURL}/api/agent-cart`),
        makeAuthenticatedRequest(`${baseURL}/api/wallet/buyer`),
      ]);

      if (!cartRes.ok || !walletRes.ok) throw new Error('Failed to fetch data');

      const [cartData, wallet] = await Promise.all([
        cartRes.json(),
        walletRes.json(),
      ]);

      // ✅ backend always returns { items: [...] }
      cart = cartData.items || [];
      walletBalance = wallet.balance || 0;

      walletEl.textContent = `Wallet: ₦${walletBalance.toLocaleString()}`;
      updateCartBadge(cart);
      displayCart();
    } catch (err) {
      console.error(err);
      window.showOverlay && showOverlay({ type:'error', title:'Error', message:'Failed to load cart. Try again.' });
    } finally { hideLoading && hideLoading(); }
  }

  // =========================
  // DISPLAY CART ITEMS
  // =========================
  function displayCart() {
    cartContainer.innerHTML = '';
    let total = 0;
  
    if (!cart.length) {
      cartContainer.innerHTML = '<p>Your cart is empty.</p>';
      totalEl.textContent = 'Total: ₦0';
      updateCartBadge(cart);
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }
  
    cart.forEach((item) => {
      const product = item.product;
      const agent = item.agent;
      const qty = item.quantity || 1;
      const price = item.price || product?.price || 0;
      const name = product?.name || 'Unnamed Product';
      const agentName = agent?.shopName || agent?.fullName || 'Unknown Agent'; // 👈 FIXED
      const subtotal = price * qty;
      const stock = Number(product?.stock ?? NaN);
      const reserved = Number(product?.reserved ?? 0);
      const hasFiniteStock = Number.isFinite(stock);
      const available = hasFiniteStock ? Math.max(0, stock - (Number.isFinite(reserved) ? reserved : 0)) : Infinity;
      const reachedMax = hasFiniteStock && qty >= available;
      const showHint = hasFiniteStock && (available <= 5 || reachedMax);
      const hintText = hasFiniteStock ? (available <= 0 ? 'Out of Stock' : `Only ${available} available`) : '';
      total += subtotal;
  
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="item-info">
          <div class="item-name">${name} (${agentName}) x ${qty}</div>
          ${showHint ? `<div class="item-price" style=\"color: var(--muted);\">${hintText}</div>` : ''}
        </div>
        <span class="item-total">₦${subtotal.toLocaleString()}</span>
        <button class="remove-btn" data-id="${product?._id}">❌</button>
        <button class="inc-btn" data-id="${product?._id}" ${reachedMax ? 'disabled' : ''}>+</button>
        <button class="dec-btn" data-id="${product?._id}">-</button>
      `;
      cartContainer.appendChild(div);
    });
  
    totalEl.textContent = `Total: ₦${total.toLocaleString()}`;
    updateCartBadge(cart);

    // Disable checkout if any item exceeds available stock
    try {
      const hasInsufficient = cart.some((item) => {
        const qty = item.quantity || 1;
        const stock = Number(item?.product?.stock ?? NaN);
        const reserved = Number(item?.product?.reserved ?? 0);
        const hasFiniteStock = Number.isFinite(stock);
        const available = hasFiniteStock ? Math.max(0, stock - (Number.isFinite(reserved) ? reserved : 0)) : Infinity;
        return hasFiniteStock && qty > available;
      });
      if (checkoutBtn) checkoutBtn.disabled = hasInsufficient === true;
    } catch (_) { /* noop */ }
  }
  

  // =========================
  // CART ACTIONS
  // =========================
  cartContainer.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    try {
      if (e.target.classList.contains('remove-btn')) {
        await makeAuthenticatedRequest(`${baseURL}/api/agent-cart/${id}`, {
          method: 'DELETE',
        });
      }

      if (e.target.classList.contains('inc-btn')) {
        const item = cart.find((i) => i.product?._id === id);
        const stock = Number(item?.product?.stock ?? NaN);
        const reserved = Number(item?.product?.reserved ?? 0);
        const hasFiniteStock = Number.isFinite(stock);
        const available = hasFiniteStock ? Math.max(0, stock - (Number.isFinite(reserved) ? reserved : 0)) : Infinity;
        const nextQty = (item.quantity || 1) + 1;
        if (hasFiniteStock && nextQty > available) {
          window.showOverlay && showOverlay({ type:'info', title:'Stock limit', message:`Only ${available} available` });
          return;
        }
        await makeAuthenticatedRequest(`${baseURL}/api/agent-cart`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: id,
            quantity: (item.quantity || 1) + 1,
          }),
        });
      }

      if (e.target.classList.contains('dec-btn')) {
        const item = cart.find((i) => i.product?._id === id);
        const newQty = (item.quantity || 1) - 1;

        if (newQty > 0) {
          await makeAuthenticatedRequest(`${baseURL}/api/agent-cart`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: id, quantity: newQty }),
          });
        } else {
          await makeAuthenticatedRequest(`${baseURL}/api/agent-cart/${id}`, {
            method: 'DELETE',
          });
        }
      }

      await loadCart();
    } catch (err) {
      console.error(err);
      window.showOverlay && showOverlay({ type:'error', title:'Error', message:'Failed to update cart. Please try again.' });
    }
  });

  // =========================
  // CART BADGE UI
  // =========================
  function updateCartBadge(items) {
    try {
      const badge = document.getElementById('cart-badge');
      if (!badge) return;

      const totalItems = (items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
      if (totalItems > 0) {
        badge.textContent = totalItems;
        badge.style.display = 'flex';
      } else {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    } catch (err) {
      console.warn('Cart badge update failed:', err);
    }
  }

  // =========================
  // CHECKOUT
  // =========================
  checkoutBtn.addEventListener('click', async () => {
    if (checkoutBtn && checkoutBtn.disabled) return;
    const state = stateInput.value.trim();
    const address = addressInput.value.trim();
    
    if (!state) return (window.showOverlay && showOverlay({ type:'error', title:'Pickup location', message:'Please select your state' }));
    
    // Combine state and address details
    const location = address ? `${state}, ${address}` : state;

    const totalAmount = cart.reduce((sum, item) => {
      const qty = item.quantity || 1;
      const price = item.price || item.product?.price || 0;
      return sum + price * qty;
    }, 0);

    if (walletBalance < totalAmount)
      return (window.showOverlay && showOverlay({ type:'error', title:'Wallet', message:'Insufficient wallet balance' }));

    try {
      showLoading && showLoading();
      const res = await makeAuthenticatedRequest(`${baseURL}/api/agent-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartItems: cart.map((i) => ({
            id: i.product?._id,
            qty: i.quantity || 1,
          })),
          deliveryLocation: location,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      window.showOverlay && showOverlay({ type:'success', title:'Success', message:'Order placed successfully!' });
      window.location.href = '/buyer-agent-orders.html';
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('insufficient stock') || msg.includes('out of stock')) {
        try { await loadCart(); } catch (_) {}
      } else {
        window.showOverlay && showOverlay({ type:'error', title:'Checkout', message:'Checkout failed. Please try again.' });
      }
    } finally { hideLoading && hideLoading(); }
  });

  // =========================
  // INITIALIZE
  // =========================
  loadCart();
});
