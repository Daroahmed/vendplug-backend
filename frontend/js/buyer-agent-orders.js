console.log("📦 buyer-agent-orders.js loaded");

// Avoid colliding with other globals (e.g., notifications.js)
const API_BASE = window.BACKEND_URL || "";
const container = document.getElementById("agentOrdersContainer");
const token = getAuthToken();

if (!token) {
  container.innerHTML = "<p>Please log in to view your orders.</p>";
  redirectToLogin();
} else {
  fetchOrders();
}

async function fetchOrders() {
  try {
    showLoading && showLoading();
    // ✅ Correct endpoint
    const res = await fetch(`${API_BASE}/api/buyer-orders`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    if (!data.length) {
      container.innerHTML = "<p>You haven't placed any agent orders yet.</p>";
      return;
    }

    container.innerHTML = "";

    // Filter for agent orders only
    const agentOrders = data.filter(order => order.type === 'agent');
    
    if (agentOrders.length === 0) {
      container.innerHTML = "<p>You haven't placed any agent orders yet.</p>";
      return;
    }

    agentOrders.forEach(order => {
      const card = document.createElement("div");
      card.className = "order-card";

      const agentName = order.agent || "Unknown Agent";
      const statusClass = order.status.toLowerCase();

      // ✅ Safely access product details
      const productList = order.products
        .map(p => {
          const productName = p.product?.name || p.name || "Unknown Product";
          const price = p.product?.price || p.price || 0;
          const qty = p.quantity || 1;
          return `<p>• ${productName} (x${qty}) - ₦${price.toLocaleString()}</p>`;
        })
        .join("");

      card.innerHTML = `
        <div class="order-header">
          <h3>${agentName}</h3>
          <span class="status-badge ${statusClass}">${order.status}</span>
        </div>
        <div class="product-list">
          ${productList}
        </div>
        <p style="font-size: 0.8rem; margin-top: 0.5rem;">
          🗓 ${new Date(order.createdAt).toLocaleString()}
        </p>
      `;

      // ✅ Click goes to details page
      card.addEventListener("click", () => {
        window.location.href = `buyer-agent-order-details.html?orderId=${order._id}`;
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error("❌ Failed to load orders:", err);
    container.innerHTML = "<p>Error loading orders.</p>";
  } finally { hideLoading && hideLoading(); }
}
