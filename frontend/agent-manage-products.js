const token = localStorage.getItem("vendplug-token");
const productGrid = document.getElementById("productGrid");

if (!token) {
  alert("You need to log in.");
  window.location.href = "agent-login.html";
}

let currentAgentId = null;

fetch("/api/agents/profile", {
  headers: { Authorization: `Bearer ${token}` }
})
  .then(res => res.json())
  .then(agent => {
    currentAgentId = agent._id;
    loadProducts();
  })
  .catch(err => {
    console.error("Agent auth error:", err);
    alert("Session expired. Please login again.");
    localStorage.clear();
    window.location.href = "agent-login.html";
  });

function loadProducts() {
  fetch("/api/products")
    .then(res => res.json())
    .then(data => {
      const products = data.products || data;
      console.log("✅ Loaded products:", products);

      if (!Array.isArray(products)) {
        throw new Error("Invalid product data.");
      }

      if (products.length === 0) {
        productGrid.innerHTML = "<p>No products uploaded yet.</p>";
        return;
      }

      productGrid.innerHTML = products.map(product => `
        <div class="product-card">
          <img src="${product.imageUrl}" alt="${product.name}" />
          <div class="product-details">
            <h4>${product.name}</h4>
            <p><strong>₦${product.price}</strong> (${product.category})</p>
            <p style="font-size: 0.8rem; color: #888;">By: ${product.agent?.fullName || "Unknown"}</p>
            <div class="action-buttons">
              <button class="edit-btn" onclick="editProduct('${product._id}')">Edit</button>
              <button class="delete-btn" onclick="deleteProduct('${product._id}')">Delete</button>
            </div>
          </div>
        </div>
      `).join("");
    })
    .catch(err => {
      console.error("❌ Product fetch error:", err);
      productGrid.innerHTML = `<p>Error loading products.</p>`;
    });
}

function deleteProduct(productId) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  fetch(`/api/products/${productId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(data => {
      alert(data.message || "Product deleted");
      loadProducts();
    })
    .catch(err => {
      console.error("❌ Delete error:", err);
      alert("Failed to delete product.");
    });
}

function editProduct(productId) {
  fetch(`/api/products/${productId}`)
    .then(res => res.json())
    .then(product => {
      const newName = prompt("Edit product name:", product.name);
      if (newName === null) return;

      const newPrice = prompt("Edit price:", product.price);
      if (newPrice === null) return;

      const newCategory = prompt("Edit category:", product.category);
      if (newCategory === null) return;

      const newImageUrl = prompt("Edit image URL:", product.imageUrl);
      if (newImageUrl === null) return;

      const updatedProduct = {
        name: newName.trim(),
        price: parseFloat(newPrice),
        category: newCategory.trim(),
        imageUrl: newImageUrl.trim(),
        description: product.description // keep the old description for now
      };

      fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedProduct)
      })
        .then(res => res.json())
        .then(data => {
          alert(data.message || "Product updated successfully");
          loadProducts();
        })
        .catch(err => {
          console.error("❌ Update error:", err);
          alert("Failed to update product.");
        });
    })
    .catch(err => {
      console.error("❌ Fetch product for edit error:", err);
      alert("Failed to load product data.");
    });
}


function logout() {
  localStorage.removeItem("vendplug-token");
  window.location.href = "agent-login.html";
}


