// vendor-payout-queue.js

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("vendplug-token");
  const vendorData = JSON.parse(localStorage.getItem("vendplugVendor"));
  const payoutQueueContainer = document.getElementById("payoutQueueContainer");

  if (!token || !vendorData) {
    alert("Session expired. Please log in again.");
    window.location.href = "vendor-auth.html";
    return;
  }

  // Fetch vendor payout queue (orders with status = pending_receipt)
  async function fetchPayoutQueue() {
    try {
      const response = await fetch("http://localhost:5000/api/vendor-payout/queue", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Failed to fetch payout queue");
      }

      const data = await response.json();
      renderPayoutQueue(data);
    } catch (error) {
      console.error("Error fetching payout queue:", error);
      payoutQueueContainer.innerHTML = `
        <p class="empty" style="color:red;">
          Error loading payout queue. Please try again later.
        </p>`;
    }
  }

  // Format date
  function formatDate(dateString) {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    } catch {
      return "N/A";
    }
  }

  // Render payout queue list
  function renderPayoutQueue(payouts) {
    if (!payouts || payouts.length === 0) {
      payoutQueueContainer.innerHTML = `<p class="empty">No orders in payout queue yet.</p>`;
      return;
    }

    payoutQueueContainer.innerHTML = "";
    payouts.forEach(payout => {
      const order = payout.order; // ✅ populated order
      const buyer = order?.buyer || {};
      const items = order?.items || [];

      const orderCard = document.createElement("div");
      orderCard.classList.add("order-card");

      orderCard.innerHTML = `
        <div class="order-header">
          <span class="order-id">Order #${order?._id || "N/A"}</span>
          <span class="status">${payout.status}</span>
        </div>
        <div><strong>Amount:</strong> ₦${payout.amount || order?.totalAmount || 0}</div>
        <div><strong>Buyer:</strong> ${buyer.fullName || buyer.name || "N/A"}</div>
        <div><strong>Email:</strong> ${buyer.email || "N/A"}</div>
        <div><strong>Phone:</strong> ${buyer.phoneNumber || buyer.phone || "N/A"}</div>
        <div><strong>Placed On:</strong> ${formatDate(order?.createdAt)}</div>
        <p class="waiting-message">⏳ Waiting for buyer confirmation…</p>
      `;

      // Add items list if available
      if (items.length > 0) {
        const itemsList = document.createElement("ul");
        itemsList.classList.add("items-list");

        items.forEach(it => {
          itemsList.innerHTML += `
            <li>
              ${it.product?.name || "Unnamed product"} 
              - ₦${it.product?.price || 0} x ${it.quantity}
            </li>`;
        });

        orderCard.appendChild(itemsList);
      }

      payoutQueueContainer.appendChild(orderCard);
    });
  }

  // Initial load
  fetchPayoutQueue();
});
