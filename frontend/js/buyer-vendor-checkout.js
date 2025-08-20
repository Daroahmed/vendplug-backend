// frontend/js/buyer-vendor-checkout.js
document.addEventListener('DOMContentLoaded', () => {
  // =========================
  // DOM ELEMENTS
  // =========================
  const cartContainer = document.getElementById('cart-items');
  const totalEl = document.getElementById('total-amount');
  const walletEl = document.getElementById('wallet-balance');
  const checkoutBtn = document.getElementById('checkout-btn');
  const locationInput = document.getElementById('pickup-location');

  // =========================
  // CONFIG & STATE
  // =========================
  const token = localStorage.getItem('vendplug-token');
  const baseURL = window.BACKEND_URL; // ✅ from config.js

  if (!baseURL) {
    console.error("❌ BACKEND_URL is not defined. Check config.js load order.");
    alert('Configuration error: BACKEND_URL not set.');
    return;
  }

  if (!token) {
    alert('Please login first');
    window.location.href = '/buyer-login.html';
    return;
  }

  let cart = [];
  let walletBalance = 0;

  // =========================
  // LOAD CART + WALLET
  // =========================
  async function loadCart() {
    try {
      const [cartRes, walletRes] = await Promise.all([
        fetch(`${baseURL}/api/vendor-cart`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${baseURL}/api/wallet/buyer`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
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
      displayCart();
    } catch (err) {
      console.error(err);
      alert('Failed to load cart. Try again.');
    }
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
      return;
    }
  
    cart.forEach((item) => {
      const product = item.product;
      const vendor = item.vendor;
      const qty = item.quantity || 1;
      const price = item.price || product?.price || 0;
      const name = product?.name || 'Unnamed Product';
      const vendorName = vendor?.shopName || vendor?.fullName || 'Unknown Vendor'; // 👈 FIXED
      const subtotal = price * qty;
      total += subtotal;
  
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <span>${name} (${vendorName}) x ${qty}</span>
        <span>₦${subtotal.toLocaleString()}</span>
        <button class="remove-btn" data-id="${product?._id}">❌</button>
        <button class="inc-btn" data-id="${product?._id}">+</button>
        <button class="dec-btn" data-id="${product?._id}">-</button>
      `;
      cartContainer.appendChild(div);
    });
  
    totalEl.textContent = `Total: ₦${total.toLocaleString()}`;
  }
  

  // =========================
  // CART ACTIONS
  // =========================
  cartContainer.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    try {
      if (e.target.classList.contains('remove-btn')) {
        await fetch(`${baseURL}/api/vendor-cart/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (e.target.classList.contains('inc-btn')) {
        const item = cart.find((i) => i.product?._id === id);
        await fetch(`${baseURL}/api/vendor-cart`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
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
          await fetch(`${baseURL}/api/vendor-cart`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ productId: id, quantity: newQty }),
          });
        } else {
          await fetch(`${baseURL}/api/vendor-cart/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      await loadCart();
    } catch (err) {
      console.error(err);
      alert('Failed to update cart. Please try again.');
    }
  });

  // =========================
  // CHECKOUT
  // =========================
  checkoutBtn.addEventListener('click', async () => {
    const location = locationInput.value.trim();
    if (!location) return alert('Please enter pickup location');

    const totalAmount = cart.reduce((sum, item) => {
      const qty = item.quantity || 1;
      const price = item.price || item.product?.price || 0;
      return sum + price * qty;
    }, 0);

    if (walletBalance < totalAmount)
      return alert('Insufficient wallet balance');

    try {
      const res = await fetch(`${baseURL}/api/vendor-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

      alert('Order placed successfully!');
      window.location.href = '/buyer-vendor-orders.html';
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });

  // =========================
  // INITIALIZE
  // =========================
  loadCart();
});
