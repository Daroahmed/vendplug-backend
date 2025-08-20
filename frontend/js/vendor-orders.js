// vendor-orders.js

// ✅ Consistent token key
const token = localStorage.getItem("vendplug-token");
if (!token) {
  console.warn("⚠️ No vendor token found. Did you login?");
}

const ordersContainer = document.getElementById("orders-container");
const orderModal = document.getElementById("orderModal");
const orderDetails = document.getElementById("orderDetails");

let currentOrderId = null;
let cachedOrders = [];

/* ---------------------------
   Fetch Vendor Orders (with filters)
---------------------------- */
async function fetchOrders() {
  try {
    const status = document.getElementById("statusFilter")?.value || "";
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";

    let url = `/api/vendor-orders?`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    if (startDate) url += `startDate=${encodeURIComponent(startDate)}&`;
    if (endDate) url += `endDate=${encodeURIComponent(endDate)}&`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("❌ Fetch failed:", errText);
      throw new Error("Failed to fetch orders");
    }

    const orders = await res.json();
    cachedOrders = orders;
    renderOrders(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    ordersContainer.innerHTML = `<p style="color:red;">Error loading orders. Please try again later.</p>`;
  }
}

/* ---------------------------
   Render Orders List
---------------------------- */
function renderOrders(orders) {
  ordersContainer.innerHTML = "";

  if (!orders.length) {
    ordersContainer.innerHTML = `<p style="color:gray;">No orders yet.</p>`;
    return;
  }

  orders.forEach((order) => {
    const div = document.createElement("div");
    div.className = "order-card";

    const firstItem = order.items?.[0];
    const productImage = firstItem?.image || "/default.jpg";

    div.innerHTML = `
      <img src="${productImage}" alt="Product"
           onerror="this.onerror=null;this.src='/default.jpg';">

      <div class="order-info">
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Buyer:</strong> ${order.buyer?.fullName || "N/A"}</p>
        <p><strong>Status:</strong>
          <span class="status ${order.status}">${order.status}</span>
        </p>
        <div class="button-group">
          <button class="view-details" data-id="${order._id}">
            View Details
          </button>
        </div>
      </div>
    `;

    ordersContainer.appendChild(div);
  });

  // 🔗 Attach modal triggers
  document.querySelectorAll(".view-details").forEach((btn) =>
    btn.addEventListener("click", (e) => openOrderModal(e.target.dataset.id))
  );
}

/* ---------------------------
   Open Order Modal
---------------------------- */
function openOrderModal(orderId) {
  const order = cachedOrders.find((o) => o._id === orderId);
  if (!order) return;

  currentOrderId = orderId;

  let actionButtons = `
    <button id="acceptBtn" class="btn-primary">Accept</button>
    <button id="rejectBtn" class="btn-danger">Reject</button>
  `;

  // Conditional status buttons
  if (order.status === "accepted") {
    actionButtons += `<button id="markPreparingBtn" class="btn-secondary">Mark as Preparing</button>`;
  } else if (order.status === "preparing") {
    actionButtons += `<button id="markOutBtn" class="btn-secondary">Mark as Out for Delivery</button>`;
  } else if (order.status === "out_for_delivery") {
    actionButtons += `<button id="markDeliveredBtn" class="btn-secondary">Mark as Delivered</button>`;
  }

  orderDetails.innerHTML = `
    <p><strong>Order ID:</strong> ${order._id}</p>
    <p><strong>Buyer:</strong> ${order.buyer?.fullName || "N/A"}</p>
    <p><strong>Email:</strong> ${order.buyer?.email || "N/A"}</p>
    <p><strong>Phone:</strong> ${order.buyer?.phoneNumber || "N/A"}</p>
    <p><strong>Address:</strong> ${order.deliveryAddress || "N/A"}</p>
    <p><strong>Status:</strong>
      <span class="status ${order.status}">${order.status}</span>
    </p>

    <h3 style="margin-top:1rem; color:#00cc99;">Products:</h3>
    <div>
      ${order.items
        .map(
          (item) => `
        <div class="order-card" style="padding:8px; display:flex; gap:8px; align-items:center;">
          <img src="${item.image || "/default.jpg"}" width="60"
               onerror="this.onerror=null;this.src='/default.jpg';">
          <div>
            <p><strong>${item.name || "Unnamed Product"}</strong></p>
            <p>Qty: ${item.quantity}</p>
            <p>₦${item.price}</p>
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <p style="margin-top:1rem;">
      <strong>Total:</strong> ₦${order.totalAmount || 0}
    </p>

    <div class="modal-actions" style="margin-top:1rem;">
      ${actionButtons}
      <button id="closeModalBtn" class="btn-close">Close</button>
    </div>
  `;

  orderModal.style.display = "flex";

  // Attach dynamic listeners
  document.getElementById("acceptBtn")?.addEventListener("click", acceptOrder);
  document.getElementById("rejectBtn")?.addEventListener("click", () => {
    const reason = prompt("Reason for rejecting?");
    if (reason?.trim()) rejectOrder(reason.trim());
  });

  document.getElementById("markPreparingBtn")?.addEventListener("click", () =>
    updateOrderStatus("preparing")
  );
  document.getElementById("markOutBtn")?.addEventListener("click", () =>
    updateOrderStatus("out_for_delivery")
  );
  document.getElementById("markDeliveredBtn")?.addEventListener("click", () =>
    updateOrderStatus("delivered")
  );

  document.getElementById("closeModalBtn")?.addEventListener("click", () => {
    orderModal.style.display = "none";
  });
}


/* ---------------------------
   Accept / Reject / Status
---------------------------- */
async function acceptOrder() {
  try {
    const res = await fetch(`/api/vendor-orders/${currentOrderId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    alert("✅ Order accepted!");
    orderModal.style.display = "none";
    fetchOrders();
  } catch (err) {
    console.error("Accept error:", err);
    alert("Something went wrong while accepting the order.");
  }
}

async function rejectOrder(reason) {
  try {
    const res = await fetch(`/api/vendor-orders/${currentOrderId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) throw new Error(await res.text());

    alert("❌ Order rejected and refunded!");
    orderModal.style.display = "none";
    fetchOrders();
  } catch (err) {
    console.error("Reject error:", err);
    alert("Something went wrong while rejecting the order.");
  }
}

async function updateOrderStatus(status) {
  try {
    const res = await fetch(`/api/vendor-orders/${currentOrderId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error(await res.text());

    alert(`📦 Order marked as ${status}!`);
    orderModal.style.display = "none";
    fetchOrders();
  } catch (err) {
    console.error("Update status error:", err);
    alert("Something went wrong while updating the status.");
  }
}

/* ---------------------------
   Modal Actions
---------------------------- */
document.getElementById("acceptBtn")?.addEventListener("click", acceptOrder);

document.getElementById("rejectBtn")?.addEventListener("click", () => {
  const reason = prompt("Reason for rejecting this order:");
  if (reason?.trim()) {
    rejectOrder(reason.trim());
  } else {
    alert("Rejection cancelled. A reason is required.");
  }
});

document.getElementById("acceptBtn")?.addEventListener("click", acceptOrder);

document.getElementById("rejectBtn")?.addEventListener("click", () => {
  const reason = prompt("Reason for rejecting this order:");
  if (reason?.trim()) {
    rejectOrder(reason.trim());
  } else {
    alert("Rejection cancelled. A reason is required.");
  }
});

document.getElementById("markDeliveredBtn")?.addEventListener("click", () => {
  updateOrderStatus("delivered");
});

document.getElementById("closeModalBtn")?.addEventListener("click", () => {
  orderModal.style.display = "none";
});


document.getElementById("closeModalBtn")?.addEventListener("click", () => {
  orderModal.style.display = "none";
});

/* ---------------------------
   Filters
---------------------------- */
document.getElementById("applyFilters")?.addEventListener("click", fetchOrders);

/* ---------------------------
   Initial Load
---------------------------- */
fetchOrders();
