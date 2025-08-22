document.addEventListener("DOMContentLoaded", async () => {
  const historyBody = document.getElementById("historyBody");
  const noRecords = document.getElementById("noRecords");

  const token = localStorage.getItem("vendplug-token");
  if (!token) {
    alert("Session expired. Please log in again.");
    window.location.href = "vendor-login.html";
    return;
  }

  const formatDate = (d) => {
    if (!d) return "N/A";
    const dt = new Date(d);
    return isNaN(dt) ? "N/A" : `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
    };

  try {
    // ✅ Correct path
    const res = await fetch("/api/vendor-payout/history", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch payout history");

    const payouts = await res.json();

    if (!payouts || payouts.length === 0) {
      noRecords.style.display = "block";
      return;
    }

    payouts.forEach((p) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p._id}</td>
        <td>₦${(p.amount ?? 0).toLocaleString()}</td>
        <td>${p.buyer?.fullName ?? "N/A"}</td>
        <td>${p.orderId ?? "N/A"}</td>
        <td>₦${(p.orderTotal ?? 0).toLocaleString()}</td>
        <td>${p.status}</td>
        <td>${formatDate(p.paidAt)}</td>
      `;
      historyBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading payout history:", error);
    alert("Could not load payout history.");
  }
});
