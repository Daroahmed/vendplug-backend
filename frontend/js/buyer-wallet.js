document.addEventListener("DOMContentLoaded", () => {
  loadWalletData();

  document.getElementById("fundTest").addEventListener("click", simulateFunding);
  document.getElementById("walletNavBtn").addEventListener("click", () => {
    loadWalletData();
    alert("🔁 Wallet reloaded");
  });
});

function loadWalletData() {
  const token = localStorage.getItem("vendplug-token");
  const buyerData = JSON.parse(localStorage.getItem("vendplugBuyer"));

  if (!token || !buyerData) {
    alert("User not logged in or data missing!");
    return;
  }

  // Set virtual account from localStorage
  document.getElementById("accountNumber").textContent = buyerData.virtualAccount || "Not Available";

  // Fetch balance from backend
  fetch(`${BACKEND_URL}/api/wallet/buyer`, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      if (data.balance !== undefined) {
        document.getElementById("walletBalance").textContent = parseFloat(data.balance).toLocaleString();
      } else {
        alert("Could not load wallet balance");
      }
    })
    .catch(err => {
      console.error("Fetch error:", err);
      alert("Error loading wallet");
    });
}

async function simulateFunding() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/wallet/fund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("vendplug-token")}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert("✅ Wallet funded");
    loadWalletData();
  } catch (err) {
    alert("❌ Failed to fund: " + err.message);
  }
}
