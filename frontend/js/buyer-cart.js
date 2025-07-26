document.addEventListener("DOMContentLoaded", () => {
  const cartContainer = document.getElementById("cart-items");
  const totalAmountEl = document.getElementById("total-amount");
  const placeOrderBtn = document.getElementById("place-order");
  const noteInput = document.getElementById("order-note");
  const locationInput = document.getElementById("pickup-location");

  // Ensure user is logged in
  const token = localStorage.getItem("vendplug-token");
  if (!token) {
    alert("You must be logged in to place an order.");
    window.location.href = "/buyer-login.html";
    return;
  }

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (!Array.isArray(cart)) throw new Error("Invalid cart structure");
  } catch {
    cart = [];
  }

  const renderCart = () => {
    cartContainer.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
      cartContainer.innerHTML = "<p class='empty-cart'>🛒 Your cart is empty</p>";
      placeOrderBtn.disabled = true;
      totalAmountEl.textContent = "₦0";
      return;
    }

    cart.forEach((item, index) => {
      total += item.price * item.qty;

      const itemEl = document.createElement("div");
      itemEl.className = "cart-item";
      itemEl.innerHTML = `
        <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}">
        <div class="cart-info">
          <h4>${item.name}</h4>
          <p>₦${Number(item.price).toLocaleString()} / ${item.unit || 'unit'}</p>
          <div class="qty-controls">
            <button class="decrease" data-index="${index}">-</button>
            <span>${item.qty}</span>
            <button class="increase" data-index="${index}">+</button>
            <button class="remove-btn" data-index="${index}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
      cartContainer.appendChild(itemEl);
    });

    totalAmountEl.textContent = `₦${total.toLocaleString()}`;
    placeOrderBtn.disabled = false;
  };

  // Quantity + Remove button handlers
  cartContainer.addEventListener("click", (e) => {
    const index = e.target.dataset.index;
    if (index === undefined) return;

    if (e.target.classList.contains("increase")) {
      cart[index].qty++;
    } else if (e.target.classList.contains("decrease")) {
      if (cart[index].qty > 1) cart[index].qty--;
    } else if (e.target.classList.contains("remove-btn") || e.target.closest(".remove-btn")) {
      cart.splice(index, 1);
    } else {
      return;
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    renderCart();
  });

  // Submit order
  placeOrderBtn.addEventListener("click", async () => {
    const pickupLocation = locationInput.value.trim();
    const note = noteInput.value.trim();

    if (!pickupLocation) {
      alert("Please provide a pickup location");
      return;
    }

    try {
      console.log("📦 Submitting order with token:", token);

      const response = await fetch(`${BACKEND_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cartItems: cart,
          pickupLocation,
          note,
          deliveryOption: "pickup"
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert("Order placed successfully!");
        localStorage.removeItem("cart");
        window.location.href = "/buyer-home.html";
      } else {
        alert("Order failed: " + data.message);
      }

    } catch (err) {
      console.error("❌ Order submission failed:", err);
      alert("Something went wrong placing the order.");
    }
  });

  renderCart();
});
