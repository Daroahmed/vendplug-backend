document.addEventListener('DOMContentLoaded', () => {

  const buyer = JSON.parse(localStorage.getItem("vendplugBuyer")); // or adjust to match your buyer storage key
  if (buyer?._id) {
    const socket = io(BACKEND_URL); // Replace with actual backend port
    socket.emit("register-buyer", buyer._id);
  
    socket.on("order-status-update", ({ orderId, newStatus }) => {
      console.log("📢 Order update:", orderId, newStatus);
  
      // Optional: Alert or refresh UI
      alert(`📦 Your order has been ${newStatus}!`);
  
      // Show bell icon
      const bell = document.getElementById("notification-bell");
      if (bell) {
        bell.classList.add("has-notification");
        bell.setAttribute("title", "Order status updated!");
      }
  
      // Optionally reload the order list if you're on the orders page
      if (typeof fetchBuyerOrders === 'function') {
        fetchBuyerOrders();
      }
    });
  }
  

  const ordersList = document.getElementById('orders-list');
  const spinner = document.getElementById('spinner');
  const token = localStorage.getItem('vendplug-token');

  if (!ordersList) return;

  if (!token) {
    spinner.remove();
    ordersList.innerHTML = `<p class="error">Please log in to view your orders.</p>`;
    return;
  }

  fetch('/api/orders/buyer', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(async res => {
      const data = await res.json();
      spinner.remove();

      if (!res.ok) {
        console.error(`❌ ${res.status}: '${JSON.stringify(data)}'`);
        ordersList.innerHTML = `<p class="error">${data.message || 'Failed to fetch orders'}</p>`;
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        ordersList.innerHTML = `<div class="empty">🛍️ You haven't placed any orders yet.</div>`;
        return;
      }

      ordersList.innerHTML = data.map(order => {
        const badge = `<span class="badge ${order.status}">${order.status}</span>`;
        const date = new Date(order.createdAt).toLocaleString('en-US', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });

        return `
          <div class="order-card">
            <h3>Order ID: ${order._id} ${badge}</h3>
            <p><strong>Pickup:</strong> ${order.pickupLocation}</p>
            <p><strong>Items:</strong> ${order.cartItems?.length || 0}</p>
            <p><strong>Date:</strong> ${date}</p>
          </div>
        `;
      }).join('');
    })
    .catch(err => {
      console.error('❌ Error fetching orders:', err);
      spinner.remove();
      ordersList.innerHTML = `<p class="error">Something went wrong fetching your orders.</p>`;
    });
});

socket.on('order-status-update', (data) => {
  alert(`Order ${data.orderId} was ${data.newStatus}`);
  // Optional: update order list on screen
});

