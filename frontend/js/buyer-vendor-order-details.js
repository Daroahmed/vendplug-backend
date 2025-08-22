console.log("📦 buyer-order-details.js loaded");

const BACKEND = window.BACKEND_URL || "";
const token = localStorage.getItem("vendplug-token");
const buyer = JSON.parse(localStorage.getItem("vendplugBuyer"));
const detailsDiv = document.getElementById("orderDetails");

// validate login + order
if (!token || !buyer) {
  window.location.href = "/buyer-login.html";
}

const params = new URLSearchParams(window.location.search);
const orderId = params.get("orderId");

if (!orderId) {
  detailsDiv.innerHTML = "<p>Invalid order request.</p>";
} else {
  fetchOrderDetails(orderId);
}

async function fetchOrderDetails(id) {
  try {
    const res = await fetch(`${BACKEND}/api/buyer-orders/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch order");

    renderOrderDetails(data);
  } catch (err) {
    console.error("❌ fetchOrderDetails error:", err);
    detailsDiv.innerHTML = "<p>Failed to load order details.</p>";
  }
}

function renderOrderDetails(order) {
  const vendorName = order.vendor || "Unknown Vendor";
  const statuses = ["pending", "accepted", "preparing", "out_for_delivery", "delivered"];
  const currentIndex = statuses.indexOf(order.status);

  detailsDiv.innerHTML = `
    <h3>${vendorName}</h3>
    <p><strong>Delivery Address:</strong> ${order.deliveryAddress || "N/A"}</p>
    <h4>Products:</h4>
    <ul>
      ${order.products.map(p => `
        <li>${p.name} - ₦${Number(p.price).toLocaleString()} × ${p.quantity}</li>
      `).join("")}
    </ul>
    <h4>Status Timeline:</h4>
    <ul class="status-timeline">
      ${statuses.map((st, i) => `
        <li class="${i <= currentIndex ? "status-active" : ""}">
          ${st.replace(/_/g, " ")}
        </li>`).join("")}
    </ul>
    <p><strong>Ordered At:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
    <div>
      <button id="confirmBtn" ${order.status !== "delivered" ? "disabled" : ""}>
        Confirm Delivery
      </button>
    </div>
  `;

  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => confirmReceipt(order._id));
  }
}

async function confirmReceipt(orderId) {
  try {
    const res = await fetch(`/api/buyer-orders/${orderId}/confirm`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    });
    

    const data = await res.json();
    if (res.ok) {
      alert("✅ Delivery confirmed!");
      fetchOrderDetails(orderId); // reload status
    } else {
      alert(`❌ ${data.message || "Failed to confirm"}`);
    }
  } catch (err) {
    console.error("❌ confirmReceipt error:", err);
  }
}
