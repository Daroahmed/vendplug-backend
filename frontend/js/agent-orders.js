// agent-orders.js

// ✅ Consistent token key
const token = localStorage.getItem("vendplug-agent-token");
if (!token) {
  console.warn("⚠️ No agent token found. Did you login?");
}

const ordersContainer = document.getElementById("orders-container");
const orderModal = document.getElementById("orderModal");
const orderDetails = document.getElementById("orderDetails");
const processFlow = document.getElementById("processFlow");

let currentOrderId = null;
let cachedOrders = [];

/* ---------------------------
   Fetch Agent Orders (with filters)
---------------------------- */
async function fetchOrders() {
  try {
    const status = document.getElementById("statusFilter")?.value || "";
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";

    let url = `/api/agent-orders?`;
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
   Render Process Flow
---------------------------- */
function renderProcessFlow(currentStatus) {
  const steps = [
    {
      id: 'pending',
      title: 'Order Received',
      description: 'Order is pending your review',
      icon: '📋'
    },
    {
      id: 'accepted',
      title: 'Order Accepted',
      description: 'You have accepted this order',
      icon: '✅'
    },
    {
      id: 'preparing',
      title: 'Preparing Order',
      description: 'Order is being prepared for delivery',
      icon: '📦'
    },
    {
      id: 'out_for_delivery',
      title: 'Out for Delivery',
      description: 'Order is on its way to buyer',
      icon: '🚚'
    },
    {
      id: 'delivered',
      title: 'Delivered',
      description: 'Order has been delivered successfully',
      icon: '🎉'
    }
  ];

  const statusOrder = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  let nextActionHint = '';
  
  if (currentStatus === 'rejected') {
    nextActionHint = '<div class="next-action-hint">❌ Order has been rejected and refunded</div>';
  } else if (currentStatus === 'delivered') {
    nextActionHint = '<div class="next-action-hint">✅ Order completed successfully!</div>';
  } else if (currentIndex >= 0) {
    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      nextActionHint = `<div class="next-action-hint">Next: ${nextStep.title}</div>`;
    }
  }

  const processFlowHTML = `
    <div class="process-flow">
      <h3 style="margin: 0 0 1rem; color: #00cc99; font-size: 1rem;">Order Progress</h3>
      ${steps.map((step, index) => {
        let stepClass = 'pending';
        
        if (currentStatus === 'rejected') {
          stepClass = index === 0 ? 'completed' : 'pending';
        } else if (currentIndex >= 0) {
          if (index < currentIndex) {
            stepClass = 'completed';
          } else if (index === currentIndex) {
            stepClass = 'current';
          } else if (index === currentIndex + 1) {
            stepClass = 'next';
          }
        }
        
        return `
          <div class="process-step ${stepClass}">
            <div class="step-icon">${step.icon}</div>
            <div class="step-content">
              <div class="step-title">${step.title}</div>
              <div class="step-description">${step.description}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${nextActionHint}
    </div>
  `;

  processFlow.innerHTML = processFlowHTML;
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

  // Conditional status buttons with glowing animation
  if (order.status === "accepted") {
    actionButtons += `<button id="markPreparingBtn" class="btn-secondary status-action">Mark as Preparing</button>`;
  } else if (order.status === "preparing") {
    actionButtons += `<button id="markOutBtn" class="btn-secondary status-action">Mark as Out for Delivery</button>`;
  } else if (order.status === "out_for_delivery") {
    actionButtons += `<button id="markDeliveredBtn" class="btn-secondary status-action">Mark as Delivered</button>`;
  }

  orderDetails.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
      <p><strong>Order ID:</strong> ${order._id}</p>
      <button onclick="copyToClipboard('${order._id}')" class="copy-btn" title="Copy Order ID">
        <i class="fas fa-copy"></i>
      </button>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
      <p><strong>Buyer ID:</strong> ${order.buyer?._id || "N/A"}</p>
      <button onclick="copyToClipboard('${order.buyer?._id || ''}')" class="copy-btn" title="Copy Buyer ID">
        <i class="fas fa-copy"></i>
      </button>
    </div>
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

    <div class=\"modal-actions\" style=\"margin-top:1rem; display:flex; gap:8px; flex-wrap:wrap;\">
      ${actionButtons}
      <button id=\"openDisputeBtn\" class=\"btn-danger\">Open Dispute</button>
      <button id=\"closeModalBtn\" class=\"btn-close\">Close</button>
    </div>
  `;

  orderModal.style.display = "flex";

  // Render process flow
  renderProcessFlow(order.status);

  // Attach dynamic listeners
  document.getElementById("acceptBtn")?.addEventListener("click", acceptOrder);
  document.getElementById("rejectBtn")?.addEventListener("click", () => {
    openRejectionModal();
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

  document.getElementById("closeModalBtn")?.addEventListener("click", closeOrderModal);
  document.getElementById("closeModalHeaderBtn")?.addEventListener("click", closeOrderModal);
  
  // Close modal when clicking outside of it
  orderModal.addEventListener("click", (e) => {
    if (e.target === orderModal) {
      closeOrderModal();
    }
  });

  document.getElementById("openDisputeBtn")?.addEventListener("click", () => showDisputeModal(order));

  // Disable accept/reject for non-pending orders
  const acceptEl = document.getElementById('acceptBtn');
  const rejectEl = document.getElementById('rejectBtn');
  if (order.status !== 'pending') {
    [acceptEl, rejectEl].forEach((btn) => {
      if (btn) {
        btn.disabled = true;
        btn.style.background = '#444';
        btn.style.color = '#777';
        btn.style.borderColor = '#555';
        btn.style.cursor = 'not-allowed';
      }
    });
  }
}


/* ---------------------------
   Accept / Reject / Status
---------------------------- */
async function acceptOrder() {
  try {
    const res = await fetch(`/api/agent-orders/${currentOrderId}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(await res.text());

    alert("✅ Order accepted!");
    // Update the order status in cached orders
    const order = cachedOrders.find(o => o._id === currentOrderId);
    if (order) {
      order.status = 'accepted';
    }
    // Refresh the modal content
    renderProcessFlow('accepted');
    openOrderModal(currentOrderId);
    fetchOrders();
  } catch (err) {
    console.error("Accept error:", err);
    alert("Something went wrong while accepting the order.");
  }
}

async function rejectOrder(reason) {
  try {
    const res = await fetch(`/api/agent-orders/${currentOrderId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rejectionReason: reason }),
    });

    if (!res.ok) throw new Error(await res.text());

    alert("❌ Order rejected and refunded!");
    // Update the order status in cached orders
    const order = cachedOrders.find(o => o._id === currentOrderId);
    if (order) {
      order.status = 'rejected';
    }
    // Refresh the modal content
    renderProcessFlow('rejected');
    openOrderModal(currentOrderId);
    fetchOrders();
  } catch (err) {
    console.error("Reject error:", err);
    alert("Something went wrong while rejecting the order.");
  }
}

async function updateOrderStatus(status) {
  try {
    const res = await fetch(`/api/agent-orders/${currentOrderId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) throw new Error(await res.text());

    alert(`📦 Order marked as ${status}!`);
    // Update the order status in cached orders
    const order = cachedOrders.find(o => o._id === currentOrderId);
    if (order) {
      order.status = status;
    }
    // Refresh the modal content
    renderProcessFlow(status);
    openOrderModal(currentOrderId);
    fetchOrders();
  } catch (err) {
    console.error("Update status error:", err);
    alert("Something went wrong while updating the status.");
  }
}

/* ---------------------------
   Rejection Modal Functions
---------------------------- */
function openRejectionModal() {
  document.getElementById("rejectionModal").style.display = "flex";
  document.getElementById("rejectionReason").value = "";
  document.getElementById("rejectionReason").focus();
}

function closeRejectionModal() {
  document.getElementById("rejectionModal").style.display = "none";
}

// Rejection modal event listeners
document.getElementById("closeRejectionModalBtn")?.addEventListener("click", closeRejectionModal);
document.getElementById("cancelRejectBtn")?.addEventListener("click", closeRejectionModal);
document.getElementById("confirmRejectBtn")?.addEventListener("click", () => {
  const reason = document.getElementById("rejectionReason").value.trim();
  if (reason.length < 10) {
    alert("Please provide a rejection reason with at least 10 characters.");
    return;
  }
  closeRejectionModal();
  rejectOrder(reason);
});

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

function closeOrderModal() {
  orderModal.style.display = "none";
  // Clear the order details to prevent stale data
  orderDetails.innerHTML = "";
  processFlow.innerHTML = "";
  currentOrderId = null;
}

/* ---------------------------
   Filters
---------------------------- */
document.getElementById("applyFilters")?.addEventListener("click", fetchOrders);

/* ---------------------------
   Copy to Clipboard Function
---------------------------- */
function copyToClipboard(text) {
  if (!text || text === 'N/A') {
    alert('Nothing to copy');
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    // Show success feedback
    const button = event.target.closest('.copy-btn');
    const originalContent = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i>';
    button.style.background = '#00cc99';
    
    setTimeout(() => {
      button.innerHTML = originalContent;
      button.style.background = '';
    }, 1500);
  }).catch(err => {
    console.error('Failed to copy: ', err);
    alert('Failed to copy to clipboard');
  });
}

/* ---------------------------
   Initial Load
---------------------------- */
fetchOrders();

/* ---------------------------
   Dispute Modal
---------------------------- */
function showDisputeModal(order) {
  const existing = document.getElementById('disputeModal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'disputeModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1e1e1e;color:#fff;padding:20px;border-radius:12px;max-width:600px;width:95%;box-shadow:0 10px 30px rgba(0,0,0,0.4);';
  modal.innerHTML = `
    <h2 style=\"margin:0 0 10px;color:#00cc99;\">Create Dispute</h2>
    <p style=\"margin:0 0 15px;color:#bbb;\">Order: <strong>${order._id}</strong> • Buyer: <strong>${order.buyer?.fullName || 'N/A'}</strong></p>
    <div style=\"display:grid;gap:12px;\">
      <input id=\"dp_title\" placeholder=\"Dispute title\" style=\"padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;\"/>
      <select id=\"dp_category\" style=\"padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;\">
        <option value=\"\">Select category</option>
        <option value=\"product_not_received\">Product Not Received</option>
        <option value=\"product_damaged\">Product Damaged</option>
        <option value=\"product_not_as_described\">Product Not As Described</option>
        <option value=\"wrong_product\">Wrong Product</option>
        <option value=\"delivery_issues\">Delivery Issues</option>
        <option value=\"payment_issues\">Payment Issues</option>
        <option value=\"communication_issues\">Communication Issues</option>
        <option value=\"other\">Other</option>
      </select>
      <textarea id=\"dp_description\" rows=\"5\" placeholder=\"Describe the issue...\" style=\"padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;\"></textarea>
      <input id=\"dp_files\" type=\"file\" multiple />
      <div style=\"display:flex;gap:10px;justify-content:flex-end;margin-top:8px;\">
        <button id=\"dp_cancel\" style=\"background:#444;color:#fff;\">Cancel</button>
        <button id=\"dp_submit\" style=\"background:#00cc99;color:#000;\">Submit Dispute</button>
      </div>
      <div style=\"color:#bbb;font-size:12px;margin-top:6px;\">We usually respond within 24–48 hours. Track progress in <a href=\"/my-disputes.html\" style=\"color:#00cc99;\">My Disputes</a>.</div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('dp_cancel').onclick = () => overlay.remove();
  document.getElementById('dp_submit').onclick = async () => {
    const title = document.getElementById('dp_title').value.trim();
    const category = document.getElementById('dp_category').value;
    const description = document.getElementById('dp_description').value.trim();
    const filesInput = document.getElementById('dp_files');

    if (!title || !category || !description) {
      return alert('Please fill in title, category and description.');
    }

    try {
      const formData = new FormData();
      const disputeData = {
        orderId: order._id,
        orderType: 'AgentOrder',
        respondentUserId: order.buyer?._id,
        respondentUserType: 'Buyer',
        title,
        description,
        category
      };
      formData.append('disputeData', JSON.stringify(disputeData));
      if (filesInput && filesInput.files && filesInput.files.length) {
        Array.from(filesInput.files).forEach(f => formData.append('evidence', f));
      }

      const res = await fetch('/api/disputes/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ Dispute created successfully');
        overlay.remove();
      } else {
        alert(`❌ ${data.error || 'Failed to create dispute'}`);
      }
    } catch (e) {
      console.error('Create dispute error:', e);
      alert('Network error. Please try again.');
    }
  };
}
