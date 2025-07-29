document.addEventListener("DOMContentLoaded", () => {
  loadBuyerWallet();

  document.getElementById("walletNavBtn")?.addEventListener("click", () => {
    loadBuyerWallet();
    alert("🔁 Wallet reloaded");
  });
});

function loadBuyerWallet() {
  const token = localStorage.getItem("vendplug-token");
  const buyerData = JSON.parse(localStorage.getItem("vendplugBuyer"));

  if (!token || !buyerData) {
    alert("Buyer not logged in or data missing!");
    return;
  }

  document.getElementById("virtual-account").textContent = buyerData.virtualAccount || "Not Available";

  fetch(`${backendUrl}/api/buyer/wallet`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.balance !== undefined) {
        document.getElementById("wallet-balance").textContent = `₦${parseFloat(data.balance).toLocaleString()}`;
      } else {
        alert("Could not fetch wallet balance");
      }
    })
    .catch((err) => {
      console.error("Error loading wallet:", err);
      alert("Error loading wallet");
    });
}
