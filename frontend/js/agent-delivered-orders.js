// agent-delivered-orders.js

// ✅ Consistent token key
const token = localStorage.getItem("vendplug-agent-token");
if (!token) {
  console.warn("⚠️ No agent token found. Did you login?");
}

const ordersContainer = document.getElementById("orders-container");
const orderModal = document.getElementById("orderModal");
const orderDetails = document.getElementById("orderDetails");

let currentOrderId = null;
let cachedOrders = [];

/* ---------------------------
   Fetch Delivered Orders (with filters)
---------------------------- */
async function fetchDeliveredOrders() {
  try {
    const status = document.getElementById("statusFilter")?.value || "";
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";

    let url = `/api/agent-orders?`;
    
    // Set status filter for delivered, fulfilled, and resolved orders
    if (status) {
      if (status === "fulfilled") {
        url += `status=fulfilled&`;
      } else if (status === "resolved") {
        url += `status=resolved&`;
      } else {
        // For "delivered" or empty, fetch delivered, fulfilled, and resolved
        url += `status=delivered&`;
      }
    } else {
      // Default to delivered, fulfilled, and resolved orders
      url += `status=delivered&`;
    }
    
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
    // Filter to show delivered, fulfilled, and resolved orders
    const deliveredOrders = orders.filter(order => 
      order.status === 'delivered' || order.status === 'fulfilled' || order.status === 'resolved'
    );
    
    cachedOrders = deliveredOrders;
    renderOrders(deliveredOrders);
    updateStats(deliveredOrders);
  } catch (error) {
    console.error("Error fetching delivered orders:", error);
    ordersContainer.innerHTML = `<p style="color:red;">Error loading orders. Please try again later.</p>`;
  }
}

/* ---------------------------
   Update Statistics
---------------------------- */
function updateStats(orders) {
  const totalDelivered = orders.filter(order => order.status === 'delivered').length;
  const totalFulfilled = orders.filter(order => order.status === 'fulfilled').length;
  const totalResolved = orders.filter(order => order.status === 'resolved').length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  document.getElementById('totalDelivered').textContent = totalDelivered;
  document.getElementById('totalFulfilled').textContent = totalFulfilled;
  document.getElementById('totalRevenue').textContent = `₦${totalRevenue.toLocaleString()}`;
}

/* ---------------------------
   Render Orders List
---------------------------- */
function renderOrders(orders) {
  ordersContainer.innerHTML = "";

  if (!orders.length) {
    ordersContainer.innerHTML = `<p style="color:gray;">No delivered orders yet.</p>`;
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
        <p><strong>Total:</strong> ₦${order.totalAmount || 0}</p>
        <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
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
    <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
    <p><strong>Delivered Date:</strong> ${order.deliveredAt ? new Date(order.deliveredAt).toLocaleDateString() : "N/A"}</p>

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

    <div class="modal-actions" style="margin-top:1rem; display:flex; gap:8px; flex-wrap:wrap;">
      <button id="openDisputeBtn" class="btn-danger">Open Dispute</button>
      <button id="closeModalBtn" class="btn-close">Close</button>
    </div>
  `;

  orderModal.style.display = "flex";

  // Attach close listener
  document.getElementById("closeModalBtn")?.addEventListener("click", closeOrderModal);

  document.getElementById("openDisputeBtn")?.addEventListener("click", () => showDisputeModal(order));
}

/* ---------------------------
   Copy to Clipboard Function
---------------------------- */
function copyToClipboard(text) {
  if (!text || text === 'N/A') {
    window.showOverlay && showOverlay({ type:'info', title:'Clipboard', message:'Nothing to copy' });
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
    window.showOverlay && showOverlay({ type:'error', title:'Clipboard', message:'Failed to copy to clipboard' });
  });
}

/* ---------------------------
   Filters
---------------------------- */
document.getElementById("applyFilters")?.addEventListener("click", fetchDeliveredOrders);

// Allow closing the modal by clicking backdrop or pressing Escape
orderModal?.addEventListener('click', (e)=>{ if (e.target === orderModal) closeOrderModal(); });
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && orderModal?.style.display === 'flex') closeOrderModal(); });

/* ---------------------------
   Initial Load
---------------------------- */
fetchDeliveredOrders();

function closeOrderModal() {
  orderModal.style.display = 'none';
}

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
    <h2 style="margin:0 0 10px;color:#00cc99;">Create Dispute</h2>
    <p style="margin:0 0 15px;color:#bbb;">Order: <strong>${order._id}</strong> • Buyer: <strong>${order.buyer?.fullName || 'N/A'}</strong></p>
    <div style="display:grid;gap:12px;">
      <input id="dp_title" placeholder="Dispute title" style="padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;"/>
      <select id="dp_category" style="padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;">
        <option value="">Select category</option>
        <option value="product_not_received">Product Not Received</option>
        <option value="product_damaged">Product Damaged</option>
        <option value="product_not_as_described">Product Not As Described</option>
        <option value="wrong_product">Wrong Product</option>
        <option value="delivery_issues">Delivery Issues</option>
        <option value="payment_issues">Payment Issues</option>
        <option value="communication_issues">Communication Issues</option>
        <option value="other">Other</option>
      </select>
      <textarea id="dp_description" rows="5" placeholder="Describe the issue..." style="padding:10px;border-radius:8px;border:1px solid #333;background:#121212;color:#fff;"></textarea>
      <input id="dp_files" type="file" multiple />
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;">
        <button id="dp_cancel" style="background:#444;color:#fff;">Cancel</button>
        <button id="dp_submit" style="background:#00cc99;color:#000;">Submit Dispute</button>
      </div>
      <div style="color:#bbb;font-size:12px;margin-top:6px;">We usually respond within 24–48 hours. Track progress in <a href="/my-disputes.html" style="color:#00cc99;">My Disputes</a>.</div>
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
      return (window.showOverlay && showOverlay({ type:'info', title:'Incomplete', message:'Please fill in title, category and description.' }));
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
        window.showOverlay && showOverlay({ type:'success', title:'Dispute', message:'Dispute created successfully' });
        overlay.remove();
      } else {
        window.showOverlay && showOverlay({ type:'error', title:'Dispute', message: data.error || 'Failed to create dispute' });
      }
    } catch (e) {
      console.error('Create dispute error:', e);
      window.showOverlay && showOverlay({ type:'error', title:'Network', message:'Network error. Please try again.' });
    }
  };
}
