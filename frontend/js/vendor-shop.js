document.addEventListener("DOMContentLoaded", () => {
  const vendorGrid = document.getElementById("vendorGrid");
  const loadingSpinner = document.getElementById("loadingSpinner");

  const API_BASE = "/api"; // Change this if your API base is different

  // ✅ Get state & category from URL first, then localStorage, then default
  const urlParams = new URLSearchParams(window.location.search);
  let state = urlParams.get("state") || localStorage.getItem("vendplug-buyer-state") || "FCT";
  let category = urlParams.get("category") || localStorage.getItem("vendplug-category") || "Groceries";

  // ✅ Save to localStorage so future visits remember choice
  localStorage.setItem("vendplug-buyer-state", state);
  localStorage.setItem("vendplug-category", category);

  console.log(`📍 State: ${state}, 📦 Category: ${category}`);

  // ✅ Fetch vendors
  async function fetchVendors() {
    try {
      loadingSpinner.style.display = "block";
      vendorGrid.innerHTML = "";

      const res = await fetch(
        `${API_BASE}/vendors/shop-vendors?state=${encodeURIComponent(state)}&category=${encodeURIComponent(category)}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch vendors");
      }

      if (!data.vendors || data.vendors.length === 0) {
        vendorGrid.innerHTML = `<p class="no-results">No vendors found for ${category} in ${state}.</p>`;
        return;
      }

      renderVendors(data.vendors);

    } catch (err) {
      console.error("❌ Error fetching vendors:", err);
      vendorGrid.innerHTML = `<p class="error">Error loading vendors. Please try again later.</p>`;
    } finally {
      loadingSpinner.style.display = "none";
    }
  }

  // ✅ Render vendors in grid
  function renderVendors(vendors) {
    vendorGrid.innerHTML = vendors.map(vendor => `
      <div class="vendor-card">
        <img src="${vendor.image || '/assets/default-vendor.jpg'}" alt="${vendor.businessName}" />
        <h3>${vendor.businessName}</h3>
        <p>${vendor.state}</p>
        <p>${vendor.category}</p>
        <button onclick="viewVendor('${vendor._id}')">View Shop</button>
      </div>
    `).join("");
  }

  // ✅ Redirect to vendor page
  window.viewVendor = (vendorId) => {
    window.location.href = `/vendor-details.html?id=${vendorId}`;
  };

  // 🔄 Initial fetch
  fetchVendors();
});
