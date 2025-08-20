document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("readyPayoutContainer");
  const token = localStorage.getItem("vendplug-token");

  if (!token) {
    container.innerHTML = `<p class="empty">Session expired. Please log in again.</p>`;
    return;
  }

  try {
    // Fetch payouts marked as "ready_for_payout"
    const res = await fetch("http://localhost:5008/api/vendor-payout/ready", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch ready for payout");
    }

    const payouts = await res.json();

    if (!payouts.length) {
      container.innerHTML = `<p class="empty">No payouts ready yet.</p>`;
      return;
    }

    container.innerHTML = "";
    payouts.forEach(payout => {
      const order = payout.order || {};
      const buyer = order?.buyer || {};

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <h3>Payout #${payout._id}</h3>
        <div class="order-info">
          <p><strong>Order:</strong> ${order._id || "N/A"}</p>
          <p><strong>Buyer:</strong> ${buyer.fullName || buyer.name || "Unknown"}</p>
          <p><strong>Amount:</strong> ₦${payout.amount || 0}</p>
          <p><strong>Status:</strong> ${payout.status}</p>
        </div>
        <button class="payout-btn" data-id="${payout._id}">Request Payout</button>
      `;
      container.appendChild(card);
    });

    // Handle payout requests
    document.querySelectorAll(".payout-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const payoutId = e.target.getAttribute("data-id");

        try {
          const payoutRes = await fetch(`http://localhost:5008/api/vendor-payout/request/${payoutId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (!payoutRes.ok) throw new Error("Failed to request payout");

          e.target.disabled = true;
          e.target.textContent = "Payout Requested ✅";
        } catch (err) {
          alert("Error: " + err.message);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="empty">Error: ${err.message}</p>`;
  }
});
