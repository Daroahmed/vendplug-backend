document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("vendplug-token");
  const role = localStorage.getItem("role");
  const agentJSON = localStorage.getItem("vendplugAgent");

  if (!token || role !== "agent" || !agentJSON) {
    alert("Session expired. Please log in again.");
    localStorage.clear();
    window.location.href = "agent-login.html";
    return;
  }

  let agentData;
  try {
    agentData = JSON.parse(agentJSON);
    if (!agentData._id) throw new Error("Invalid session data");
  } catch (err) {
    console.error("❌ Session parse error:", err);
    localStorage.clear();
    window.location.href = "agent-login.html";
    return;
  }

  console.log("✅ Agent authenticated:", agentData.fullName);
  loadPickupOrders();
  setupSocket(agentData._id);
  fetchNotifications();
  setInterval(fetchNotifications, 60000); // Refresh every 60s
});

// ✅ Load pickup orders for agent
function loadPickupOrders() {
  const token = localStorage.getItem("vendplug-token");
  const tbody = document.getElementById("pickupTable");

  fetch("/api/agents/orders", {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(orders => {
      tbody.innerHTML = "";
      const filtered = orders.filter(o =>
        o.status === "pending" || o.status === "in-progress"
      );

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">No pickup requests at the moment.</td></tr>`;
        return;
      }

      filtered.forEach((order, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td data-label="#">${index + 1}</td>
          <td data-label="Buyer">${order.buyer?.fullName || "N/A"}</td>
          <td data-label="Pickup Location">${order.pickupLocation || "N/A"}</td>
          <td data-label="Status"><span class="badge ${statusClass(order.status)}">${order.status}</span></td>
          <td data-label="Actions" class="actions">
            ${order.status === "pending" ? `<button class="progress-btn" onclick="updateStatus('${order._id}', 'in-progress')">Mark In Progress</button>` : ''}
            <button class="complete-btn" onclick="updateStatus('${order._id}', 'completed')">Mark Completed</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(err => {
      console.error("❌ Failed to load orders:", err);
      tbody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading orders</td></tr>`;
    });
}

// ✅ Update order status
function updateStatus(orderId, newStatus) {
  const token = localStorage.getItem("vendplug-token");

  fetch(`/api/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: newStatus })
  })
    .then(res => res.json())
    .then(() => {
      alert(`Order marked as ${newStatus}`);
      loadPickupOrders();
    })
    .catch(err => {
      console.error("❌ Failed to update order:", err);
      alert("Failed to update order status.");
    });
}

// ✅ Return badge class by status
function statusClass(status) {
  return status === "pending" ? "pending"
    : status === "in-progress" ? "in-progress"
    : status === "completed" ? "completed"
    : "";
}

// ✅ Real-time socket setup
function setupSocket(agentId) {
  const socket = io();

  socket.emit("join-agent-room", agentId);
  console.log("📡 Socket joined room: agent_", agentId);

  socket.on("new-order", (data) => {
    console.log("📨 New Order received:", data);
    alert("🛎️ New pickup order received!");

    loadPickupOrders();
    fetchNotifications();
  });
}

// ✅ Fetch and render notifications
function fetchNotifications() {
  const token = localStorage.getItem("vendplug-token");

  fetch('/api/notifications', {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(notifs => {
      const list = document.getElementById('notification-list');
      const countBadge = document.getElementById('notif-count');

      let unreadCount = 0;
      list.innerHTML = "";

      notifs.forEach(n => {
        const li = document.createElement('li');
        li.className = n.isRead ? "read" : "unread";
        li.innerHTML = `
          <div>
            <p style="margin: 0.2rem 0;">${n.message}</p>
            <small style="color: #888;">${new Date(n.createdAt).toLocaleString()}</small>
          </div>
        `;
        list.appendChild(li);
        if (!n.isRead) unreadCount++;
      });

      if (unreadCount > 0) {
        countBadge.innerText = unreadCount;
        countBadge.style.display = 'inline-block';
      } else {
        countBadge.innerText = "";
        countBadge.style.display = 'none';
      }
    })
    .catch(err => {
      console.error("❌ Failed to fetch notifications:", err);
    });
}

// ✅ Mark all as read
function markAllAsRead() {
  const token = localStorage.getItem("vendplug-token");

  fetch('/api/notifications/mark-read', {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then(() => fetchNotifications())
    .catch(err => {
      console.error("❌ Failed to mark as read:", err);
    });
}

// ✅ Toggle dropdown panel
function toggleNotificationPanel() {
  const panel = document.getElementById("notification-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
}

// ✅ Auto-close on outside click
document.addEventListener("click", (e) => {
  const panel = document.getElementById("notification-panel");
  const bell = document.getElementById("notification-bell");

  if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
    panel.style.display = "none";
  }
});
