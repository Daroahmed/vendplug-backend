// frontend/js/agent-orders.js
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("vendplug-token");
    const agentJSON = localStorage.getItem("vendplugAgent");
    const role = localStorage.getItem("role");
  
    if (!token || !agentJSON || role !== "agent") {
      alert("Session expired. Please log in again.");
      localStorage.clear();
      window.location.href = "agent-login.html";
      return;
    }
  
    let agentData;
    try {
      agentData = JSON.parse(agentJSON);
    } catch (err) {
      console.error("Failed to parse agent session:", err);
      return;
    }
  
    loadAgentOrders();
  });
  
  function loadAgentOrders() {
    const token = localStorage.getItem("vendplug-token");
  
    fetch("/api/agents/orders", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(orders => {
        const tbody = document.getElementById("orderTableBody");
        tbody.innerHTML = "";
  
        if (!Array.isArray(orders) || orders.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6">No orders found.</td></tr>`;
          return;
        }
  
        orders.forEach((order, index) => {
          const row = document.createElement("tr");
          row.innerHTML = `
            <td data-label="#">${index + 1}</td>
            <td data-label="Buyer">${order.buyer?.fullName || "N/A"}</td>
            <td data-label="Pickup">${order.pickupLocation || "N/A"}</td>
            <td data-label="Status"><span class="badge ${badgeClass(order.status)}">${order.status}</span></td>
            <td data-label="Date">${new Date(order.createdAt).toLocaleDateString()}</td>
            <td data-label="Actions">
              <button class="view-btn" onclick="viewOrder(${encodeURIComponent(JSON.stringify(order))})">View</button>
            </td>
          `;
          document.getElementById("orderTableBody").appendChild(row);
        });
      })
      .catch(err => {
        console.error("❌ Failed to load agent orders:", err);
        document.getElementById("orderTableBody").innerHTML = `<tr><td colspan="6" style="color:red;">Error loading orders</td></tr>`;
      });
  }
  
  function badgeClass(status) {
    return status === "pending" ? "pending"
      : status === "in-progress" ? "in-progress"
      : status === "completed" ? "completed"
      : status === "cancelled" ? "cancelled"
      : "";
  }
  
  function viewOrder(order) {
    const parsed = typeof order === "string" ? JSON.parse(decodeURIComponent(order)) : order;
    document.getElementById("modalBuyer").innerText = parsed.buyer?.fullName || "N/A";
    document.getElementById("modalPickup").innerText = parsed.pickupLocation || "N/A";
    document.getElementById("modalStatus").innerText = parsed.status;
    document.getElementById("modalAmount").innerText = "₦" + (parsed.totalAmount || 0).toLocaleString();
    document.getElementById("modalCreated").innerText = new Date(parsed.createdAt).toLocaleString();
    document.getElementById("orderModal").style.display = "flex";
  }
  
  function closeModal() {
    document.getElementById("orderModal").style.display = "none";
  }
  