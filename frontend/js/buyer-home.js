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
          <img src="${product.image || 'https://via.placeholder.com/150x120'}" alt="${product.name}" />
          <div class="info">
            <h4>${product.name}</h4>
            <p>₦${Number(product.price).toLocaleString()} / ${product.unit || "unit"}</p>
          </div>
          <button 
            class="add-to-cart"
            data-id="${product._id}"
            data-name="${product.name}"
            data-price="${product.price}"
            data-unit="${product.unit}"
            data-image="${product.image}"
          >
            Add +
          </button>
        `;
        container.appendChild(card);
      });

      // 🛒 3. Cart functionality
      document.querySelectorAll(".add-to-cart").forEach(button => {
        button.addEventListener("click", () => {
          const id = button.dataset.id;
          const name = button.dataset.name;
          const price = parseFloat(button.dataset.price);
          const unit = button.dataset.unit;
          const image = button.dataset.image;

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

          button.textContent = "Added ✓";
          button.disabled = true;
          setTimeout(() => {
            button.textContent = "Add +";
            button.disabled = false;
          }, 1200);
        });
      });
    })
    .catch(err => {
      console.error("❌ Failed to load products:", err);
    });
});
