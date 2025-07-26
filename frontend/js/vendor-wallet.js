document.addEventListener("DOMContentLoaded", () => {
  loadVendorWallet();

  document.getElementById("fundTest").addEventListener("click", simulateVendorFunding);
  document.getElementById("walletNavBtn").addEventListener("click", () => {
    loadVendorWallet();
    alert("🔁 Wallet reloaded");
  });
});

function loadVendorWallet() {
  const token = localStorage.getItem("vendplug-token");
  const vendorData = JSON.parse(localStorage.getItem("vendplugVendor"));

  if (!token || !vendorData) {
    alert("Vendor not logged in or data missing!");
    return;
  }

  // Set virtual account from localStorage
  document.getElementById("accountNumber").textContent = vendorData.virtualAccount || "Not Available";

  // Fetch balance from backend
  fetch(`${BACKEND_URL}/api/wallet/vendor`, {
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

async function simulateVendorFunding() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/wallet/vendor/fund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("vendplug-token")}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    alert("✅ Vendor wallet funded");
    loadVendorWallet();
  } catch (err) {
    alert("❌ Failed to fund: " + err.message);
  }
}
