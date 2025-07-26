// Fetch history data
let historyData = [];

fetch('/api/orders/agent/history', {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    historyData = data;
    renderTable(historyData); // Assume you have a renderTable() function
  })
  .catch(err => {
    console.error("Error loading history:", err);
    alert("Failed to load order history.");
  });

// Export to CSV
function exportToCSV() {
  // Get the currently filtered orders
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value.toLowerCase();
  const date = document.getElementById("dateFilter").value;

  const filtered = historyData.filter(order => {
    const buyerName = (order.buyer?.fullName || '').toLowerCase();
    const orderStatus = order.status.toLowerCase();
    const createdAt = new Date(order.createdAt).toISOString().split('T')[0];

    return (
      (!search || buyerName.includes(search)) &&
      (!status || orderStatus === status) &&
      (!date || createdAt === date)
    );
  });

  if (!filtered.length) return alert("No filtered data to export.");

  const headers = ['Buyer', 'Pickup', 'Status', 'Placed On', 'Updated'];
  const rows = filtered.map(order => [
    order.buyer?.fullName || '',
    order.pickupLocation || '',
    order.status,
    new Date(order.createdAt).toLocaleDateString(),
    new Date(order.updatedAt).toLocaleDateString()
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + 
    [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `vendplug_order_history.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Modal viewer
function openModal(orderId) {
  const order = historyData.find(o => o._id === orderId);
  if (!order) return;

  document.getElementById("modalContent").innerHTML = `
    <p><strong>Buyer:</strong> ${order.buyer?.fullName || 'N/A'}</p>
    <p><strong>Pickup:</strong> ${order.pickupLocation}</p>
    <p><strong>Status:</strong> ${order.status}</p>
    <p><strong>Created:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
    <p><strong>Updated:</strong> ${new Date(order.updatedAt).toLocaleString()}</p>
  `;

  document.getElementById("orderModal").style.display = "flex";
}

function closeModal() {
  document.getElementById("orderModal").style.display = "none";
}
