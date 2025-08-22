document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("vendplug-token");
    if (!token) {
      alert("Please log in first");
      window.location.href = "/buyer-login.html";
      return;
    }
  
    try {
      const res = await fetch("/api/buyer-orders/history", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!res.ok) {
        throw new Error("Failed to fetch payout history");
      }
  
      const history = await res.json();
      const tableBody = document.querySelector("#history-table tbody");
  
      tableBody.innerHTML = "";
  
      if (history.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4">No payout history found</td></tr>`;
        return;
      }
  
      history.forEach((payout) => {
        const row = document.createElement("tr");
  
        // ✅ Safe guards with fallback values
        const amount = payout.amount
          ? Number(payout.amount).toLocaleString()
          : "0";
  
        const date = payout.createdAt
          ? new Date(payout.createdAt).toLocaleDateString()
          : "N/A";
  
        const status = payout.status || "N/A";

                row.innerHTML = `
        <td class="border px-4 py-2">${payout.vendor ? payout.vendor.name : "N/A"}</td>
        <td class="border px-4 py-2">${payout._id}</td>
        <td class="border px-4 py-2">₦${(payout.amount || 0).toLocaleString()}</td>
        <td class="border px-4 py-2">${new Date(payout.createdAt).toLocaleDateString()}</td>
        <td class="border px-4 py-2">${payout.status}</td>
   
        `;
  
        tableBody.appendChild(row);
      });
    } catch (err) {
      console.error(err);
      alert("Error loading payout history");
    }
  });
  