document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("vendplug-token");
    const vendorData = JSON.parse(localStorage.getItem("vendplugVendor") || "{}");
  
    if (!token || !vendorData._id) {
      alert("Session expired. Please log in.");
      window.location.href = "vendor-login.html";
      return;
    }
  
    const form = document.getElementById("product-form");
    const productList = document.getElementById("product-list");
    const nameInput = document.getElementById("name");
    const priceInput = document.getElementById("price");
    const categoryInput = document.getElementById("category");
    const imageInput = document.getElementById("image");
  
    let editingProductId = null;
  
    // Load existing products
    fetch("/api/vendor/products", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(renderProducts)
      .catch(err => {
        console.error("Failed to load products", err);
        productList.innerHTML += "<p>Error loading products.</p>";
      });
  
    // Handle form submit
    form.addEventListener("submit", (e) => {
      e.preventDefault();
  
      const product = {
        name: nameInput.value.trim(),
        price: parseFloat(priceInput.value),
        category: categoryInput.value.trim(),
        image: imageInput.value.trim()
      };
  
      if (!product.name || isNaN(product.price) || !product.category) {
        return alert("Please fill all required fields correctly.");
      }
  
      if (editingProductId) {
        // Edit product
        fetch(`/api/vendor/products/${editingProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(product)
        })
          .then(res => res.json())
          .then(() => {
            alert("Product updated.");
            resetForm();
            loadProducts();
          })
          .catch(err => {
            console.error("Update failed", err);
            alert("Failed to update product.");
          });
      } else {
        // Create new product
        fetch("/api/vendor/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(product)
        })
          .then(res => res.json())
          .then(() => {
            alert("Product added.");
            resetForm();
            loadProducts();
          })
          .catch(err => {
            console.error("Add failed", err);
            alert("Failed to add product.");
          });
      }
    });
  
    function loadProducts() {
      fetch("/api/vendor/products", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(renderProducts)
        .catch(err => {
          console.error("Reload failed", err);
          productList.innerHTML += "<p>Error reloading products.</p>";
        });
    }
  
    function renderProducts(products) {
      const container = document.getElementById("product-list");
      container.innerHTML = "<h2>My Products</h2>";
  
      if (!products.length) {
        container.innerHTML += "<p>No products yet.</p>";
        return;
      }
  
      products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
  
        const info = document.createElement("div");
        info.className = "info";
        info.innerHTML = `
          <strong>${product.name}</strong><br/>
          ₦${product.price.toFixed(2)} • ${product.category}
        `;
  
        const actions = document.createElement("div");
        actions.className = "actions";
  
        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.onclick = () => {
          nameInput.value = product.name;
          priceInput.value = product.price;
          categoryInput.value = product.category;
          imageInput.value = product.image || "";
          editingProductId = product._id;
          form.querySelector("button").textContent = "Update Product";
        };
  
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => {
          if (confirm("Are you sure you want to delete this product?")) {
            fetch(`/api/vendor/products/${product._id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`
              }
            })
              .then(res => res.json())
              .then(() => {
                alert("Product deleted.");
                loadProducts();
              })
              .catch(err => {
                console.error("Delete failed", err);
                alert("Could not delete product.");
              });
          }
        };
  
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
  
        card.appendChild(info);
        card.appendChild(actions);
        container.appendChild(card);
      });
    }
  
    function resetForm() {
      nameInput.value = "";
      priceInput.value = "";
      categoryInput.value = "";
      imageInput.value = "";
      editingProductId = null;
      form.querySelector("button").textContent = "Add Product";
    }
  });
  