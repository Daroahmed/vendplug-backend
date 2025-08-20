document.addEventListener("DOMContentLoaded", async () => {
    const historyBody = document.getElementById("historyBody");
    const noRecords = document.getElementById("noRecords");
  
    const token = localStorage.getItem("vendplug-token");
    if (!token) {
      alert("Session expired. Please log in again.");
      window.location.href = "vendor-login.html";
      return;
    }
  
    try {
      const res = await fetch("/api/payouts/vendor/history", {
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
  
      payouts.forEach(payout => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${payout._id}</td>
          <td>₦${payout.amount.toLocaleString()}</td>
          <td>${new Date(payout.date).toLocaleDateString()}</td>
        `;
        historyBody.appendChild(row);
      });
  
    } catch (error) {
      console.error("Error loading payout history:", error);
      alert("Could not load payout history.");
    }
  });
  