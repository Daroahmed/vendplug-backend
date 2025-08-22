document.addEventListener("DOMContentLoaded", () => {
  // 🔐 1. Enforce buyer login
  const token = localStorage.getItem("vendplug-token");
  if (!token) {
    alert("You must be logged in to view this page.");
    window.location.href = "/buyer-login.html";
    return;
  }

  // 🪵 Optional debug
  console.log("Buyer token:", token);

  // Hide the loading spinner when products are loaded
  const loadingElement = document.querySelector('.loading');
  
  // 🛒 2. Fetch and display products
  fetch("/api/products")
    .then(response => response.json())
    .then(data => {
      const products = data.products;
      const categoryMap = {
        "Vegetables": "fresh-vegetables",
        "Grains": "grains-provisions",
        "Provisions": "grains-provisions",
        "Others": "others"
      };

      products.forEach(product => {
        const sectionId = categoryMap[product.category] || "others";
        const container = document.getElementById(sectionId);
        if (!container) return;

        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
          <img src="${product.image || 'https://placehold.co/200x160/2c2c2c/00cc99/png?text=Product'}" class="product-image" alt="${product.name}">
          <div class="product-info">
            <h4>${product.name}</h4>
            <p>${product.description || 'Fresh from local farms'}</p>
            <div class="product-price">₦${Number(product.price).toLocaleString()} / ${product.unit || "unit"}</div>
            <button 
              class="add-to-cart"
              data-id="${product._id}"
              data-name="${product.name}"
              data-price="${product.price}"
              data-unit="${product.unit}"
              data-image="${product.image}"
            >
              <i class="fas fa-plus"></i>
            </button>
          </div>
        `;
        container.appendChild(card);
      });

      // Hide loading spinner after products are loaded
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }

      // 🛒 3. Cart functionality
      document.querySelectorAll(".add-to-cart").forEach(button => {
        button.addEventListener("click", function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          const price = parseFloat(this.dataset.price);
          const unit = this.dataset.unit;
          const image = this.dataset.image;

          // ✅ Safe parsing of cart
          let cart = [];
          try {
            cart = JSON.parse(localStorage.getItem("cart")) || [];
            if (!Array.isArray(cart)) throw new Error("Invalid cart structure");
          } catch {
            cart = [];
          }

          const exists = cart.find(item => item.id === id);
          if (exists) {
            exists.qty += 1;
          } else {
            cart.push({ id, name, price, unit, image, qty: 1 });
          }

          localStorage.setItem("cart", JSON.stringify(cart));

          // Update cart count in header
          const cartCount = document.querySelector('.cart-count');
          if (cartCount) {
            const totalItems = cart.reduce((total, item) => total + item.qty, 0);
            cartCount.textContent = totalItems;
          }

          // Visual feedback for adding to cart
          const icon = this.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-check';
            setTimeout(() => {
              icon.className = 'fas fa-plus';
            }, 1000);
          }
        });
      });
    })
    .catch(err => {
      console.error("❌ Failed to load products:", err);
      // Hide loading spinner even if there's an error
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
    });
});
