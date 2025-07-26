// js/buyer-dashboard.js

const token = localStorage.getItem("vendplug-token");
const buyer = JSON.parse(localStorage.getItem("buyer"));

// Show name
document.getElementById("buyerName").textContent = buyer?.fullName || "Buyer";

let allProducts = []; // store all loaded products

async function loadProducts() {
  try {
    const res = await fetch("/api/products"); // Make sure /api/products exists!
    const data = await res.json();
    allProducts = data.products || [];
    displayProducts(allProducts);
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

function displayProducts(products) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <img src="${p.image || 'https://via.placeholder.com/150'}" alt="${p.name}">
      <h4>${p.name}</h4>
      <p>₦${p.price}</p>
      <button class="add-btn" onclick="addToCart('${p._id}')">Add to List</button>
    </div>
  `).join('');
}

function addToCart(productId) {
  // For now, just show alert. We’ll later build actual cart logic.
  const product = allProducts.find(p => p._id === productId);
  alert(`Added "${product.name}" to your list`);
}

function searchProducts() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const results = allProducts.filter(p => p.name.toLowerCase().includes(query));
  displayProducts(results);
}

function filterByCategory(cat) {
  if (cat === 'All') return displayProducts(allProducts);
  const filtered = allProducts.filter(p => p.category === cat);
  displayProducts(filtered);
}

loadProducts();
