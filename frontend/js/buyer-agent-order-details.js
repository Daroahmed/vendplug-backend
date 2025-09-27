console.log("📦 buyer-order-details.js loaded");

// Avoid global name collisions
const API_BASE = window.BACKEND_URL || "";
const token = getAuthToken();
const buyer = getCurrentUser();
const detailsDiv = document.getElementById("orderDetails");

// Copy to clipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Show a temporary success message
    const button = event.target.closest('.copy-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '#00cc99';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy: ', err);
    window.showOverlay && showOverlay({ type:'error', title:'Clipboard', message:'Failed to copy to clipboard' });
  });
}

// validate login + order
if (!token || !buyer) {
  window.location.href = "/buyer-auth.html";
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
    const res = await fetch(`${API_BASE}/api/buyer-orders/${id}`, {
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
  const agentName = order.agent || "Unknown Agent";
  const statuses = ["pending", "accepted", "preparing", "out_for_delivery", "delivered"];
  const currentIndex = statuses.indexOf(order.status);

  detailsDiv.innerHTML = `
    <div class="order-header">
      <div class="order-id">Order #: <span id="orderNumber">${order._id}</span></div>
      <div class="current-status" id="currentStatus">${order.status}</div>
    </div>
    
    <div class="info-row">
      <strong>Order ID:</strong> 
      <span>${order._id}</span>
      <button onclick="copyToClipboard('${order._id}')" class="copy-btn" title="Copy Order ID">
        <i class="fas fa-copy"></i> Copy
      </button>
    </div>
    
    <div class="info-row">
      <strong>Agent ID:</strong> 
      <span>${order.agentId || "N/A"}</span>
      ${order.agentId ? `<button onclick="copyToClipboard('${order.agentId}')" class="copy-btn" title="Copy Agent ID">
        <i class="fas fa-copy"></i> Copy
      </button>` : ''}
    </div>
    
    <div class="info-row">
      <strong>Agent:</strong> 
      <span>${agentName}</span>
    </div>
    
    <div class="info-row">
      <strong>Delivery Address:</strong> 
      <span>${order.deliveryLocation || "N/A"}</span>
    </div>
    
    <div class="info-row">
      <strong>Total Amount:</strong> 
      <span>₦${Number(order.totalAmount).toLocaleString()}</span>
    </div>
    
    <div class="info-row">
      <strong>Ordered At:</strong> 
      <span>${new Date(order.createdAt).toLocaleString()}</span>
    </div>
    
    <h4 style="margin-top: 1.5rem; color: #00cc99;">Products:</h4>
    <ul>
      ${order.products.map(p => `
        <li>${p.name} - ₦${Number(p.price).toLocaleString()} × ${p.quantity}</li>
      `).join("")}
    </ul>
    
    <h4 style="margin-top: 1.5rem; color: #00cc99;">Status Timeline:</h4>
    <ul class="status-timeline">
      ${statuses.map((st, i) => `
        <li class="${i <= currentIndex ? "status-active" : ""}">
          ${st.replace(/_/g, " ")}
        </li>`).join("")}
    </ul>
    
    <div style=\"margin-top: 1.5rem; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;\">
      <button id=\"confirmBtn\" ${order.status !== "delivered" ? "disabled" : ""}>
        Confirm Delivery
      </button>
      <button id=\"openDisputeBtn\" style=\"background:#ff5b5b;color:#000;\">
        Open Dispute
      </button>
      <span style=\"color:#bbb;font-size:12px;\">Note: After confirming delivery, you can no longer open a dispute.</span>
    </div>
  `;

  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => confirmReceipt(order._id));
  }

  const openDisputeBtn = document.getElementById("openDisputeBtn");
  if (openDisputeBtn) {
    openDisputeBtn.addEventListener("click", () => showDisputeModal(order));
  }
}

async function confirmReceipt(orderId) {
  // Show warning about dispute eligibility
  const confirmed = confirm(
    "⚠️ IMPORTANT: By confirming delivery, you acknowledge that:\n\n" +
    "• The order has been delivered as expected\n" +
    "• You will NOT be able to open a dispute after confirmation\n" +
    "• The vendor/agent will receive payment\n" +
    "• Only open disputes if you have concerns about the order\n\n" +
    "Are you sure you want to confirm delivery?"
  );
  
  if (!confirmed) {
    return;
  }

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
      window.showOverlay && showOverlay({ type:'success', title:'Delivery', message:'Delivery confirmed! Payment has been released to the vendor/agent.' });
      fetchOrderDetails(orderId); // reload status
    } else {
      window.showOverlay && showOverlay({ type:'error', title:'Delivery', message: data.message || 'Failed to confirm' });
    }
  } catch (err) {
    console.error("❌ confirmReceipt error:", err);
  }
}

// Dispute modal (inline, self-contained)
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
    <p style=\"margin:0 0 15px;color:#bbb;\">Order: <strong>${order._id}</strong></p>
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
        respondentUserId: order.agentId,
        respondentUserType: 'Agent',
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
