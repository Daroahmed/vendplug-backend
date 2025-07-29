document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("vendplug-token");
  const agent = JSON.parse(localStorage.getItem("vendplugAgent"));
  const agentId = agent?._id;

  if (!token || !agentId) {
    alert("Please log in again.");
    return window.location.href = "/agent-login.html";
  }

  const BASE_URL = "http://localhost:5006"; // Or your production server URL

  fetch(`${BASE_URL}/api/wallet/${agentId}`, {
  
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data && data.virtualAccount && typeof data.balance === "number") {
      document.getElementById("accountNumber").textContent = data.virtualAccount;
      document.getElementById("walletBalance").textContent = data.balance.toLocaleString();
    } else {
      throw new Error("Invalid wallet data");
    }
  })
  .catch(err => {
    console.error("Error fetching wallet:", err);
    alert("Failed to load wallet. Try again.");
  });

  document.getElementById("walletNavBtn").addEventListener("click", () => {
    window.location.reload();
  });

  document.getElementById("fundTest").addEventListener("click", () => {
    fetch(`${BASE_URL}/api/wallet/fund-test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-user-type": "agent"
      }
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "Funded");
      window.location.reload();
    })
    .catch(err => {
      console.error("Fund test error:", err);
      alert("Funding failed.");
    });
  });
});
