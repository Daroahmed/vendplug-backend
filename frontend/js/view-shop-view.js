let allReviews = [];
let currentReviewIndex = 0;
const reviewsPerPage = 5;
let currentProduct = null;
let vendorId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  if (!productId) return;

  try {
    const res = await fetch(`/api/vendor-products/public/${productId}`);
    if (!res.ok) throw new Error("Failed to fetch product");
    const product = await res.json();
    currentProduct = product;
    vendorId = product.vendor._id;

    loadProductDetails(product);
    loadVendorDetails(vendorId);

    // Add to Cart
    document.getElementById('addToCartBtn').addEventListener('click', () => {
      addToCart(product);
    });

  } catch (err) {
    console.error("Error loading product:", err);
  }
});

function loadProductDetails(product) {
  document.getElementById('productImage').src = product.image || '';
  document.getElementById('productName').textContent = product.name;
  document.getElementById('productPrice').textContent = `₦${product.price}`;
  const stock = Number(product.stock || 0);
  const reserved = Number(product.reserved || 0);
  const available = Math.max(0, stock - reserved);
  const soldEl = document.getElementById('soldCount');
  if (available <= 0) {
    soldEl.textContent = 'Out of Stock';
  } else {
    const hint = available <= 5 ? `<span style="margin-left:8px;color: var(--muted);font-size:0.9rem;">Only ${available} available</span>` : '';
    soldEl.innerHTML = `Stock: ${available} ${hint}`;
  }
  const addBtn = document.getElementById('addToCartBtn');
  if (available <= 0) {
    addBtn.disabled = true;
    addBtn.style.opacity = '0.6';
    addBtn.style.cursor = 'not-allowed';
    addBtn.innerHTML = '<i class="fas fa-ban"></i> Out of Stock';
  }
  document.getElementById('productDescription').textContent = product.description;
  document.getElementById('accountNumber').textContent = product.vendor?.virtualAccount || '';
}

async function loadVendorDetails(vendorId) {
  try {
    const res = await fetch(`/api/vendors/${vendorId}`);
    if (!res.ok) throw new Error("Failed to fetch vendor");
    const vendor = await res.json();

    // Store all reviews
    allReviews = vendor.reviews || [];

    // Show average rating
    const reviewsContainer = document.getElementById('reviewsContainer');
    const avgRating = vendor.averageRating ? vendor.averageRating.toFixed(1) : "0.0";
    reviewsContainer.innerHTML = `<h4>Average Rating: ${avgRating} ★</h4>`;

    // Load first batch
    displayMoreReviews();

    // Show load more button if needed
    if (allReviews.length > reviewsPerPage) {
      document.getElementById('loadMoreReviewsBtn').style.display = 'block';
      document.getElementById('loadMoreReviewsBtn').addEventListener('click', displayMoreReviews);
    }

    // Handle review submission
    document.getElementById('submitReviewBtn').addEventListener('click', async () => {
      const rating = document.getElementById('reviewRating').value;
      const comment = document.getElementById('reviewComment').value;

      if (!rating || !comment) {
        return (window.showOverlay && showOverlay({ type:'error', title:'Incomplete', message:'Please enter both a rating and a comment.' }));
      }

      try {
        const token = getAuthToken();
        if (!token) {
          return (window.showOverlay && showOverlay({ type:'error', title:'Login required', message:'You must be logged in to leave a review.' }));
        }

        const reviewRes = await fetch(`/api/vendors/${vendorId}/reviews`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ rating, comment })
        });

        if (!reviewRes.ok) {
          const errData = await reviewRes.json();
          throw new Error(errData.message || "Failed to submit review");
        }

        window.showOverlay && showOverlay({ type:'success', title:'Thank you!', message:'Review submitted successfully!' });
        location.reload();
      } catch (err) {
        window.showOverlay && showOverlay({ type:'error', title:'Error', message: err.message || 'Something went wrong' });
      }
    });

  } catch (err) {
    console.error("Error loading vendor details:", err);
  }
}

function displayMoreReviews() {
  const container = document.getElementById('reviewsContainer');
  const endIndex = currentReviewIndex + reviewsPerPage;

  allReviews.slice(currentReviewIndex, endIndex).forEach(r => {
    const div = document.createElement('div');
    div.className = 'review';
    div.innerHTML = `<strong>${r.buyer?.fullName || 'Anonymous'}</strong> - ${r.rating} ★<p>${r.comment}</p>`;
    container.appendChild(div);
  });

  currentReviewIndex = endIndex;

  // Hide button if no more reviews
  if (currentReviewIndex >= allReviews.length) {
    document.getElementById('loadMoreReviewsBtn').style.display = 'none';
  }
}

// Add to Cart Logic
// Assuming you have BACKEND_URL and token already
async function addToCart(productId, quantity = 1) {
  const token = getAuthToken();

  if (!token) {
      window.showOverlay && showOverlay({ type:'error', title:'Login required', message:'Please log in to add items to your cart.' });
      return;
  }

  try {
      const response = await fetch(`${window.BACKEND_URL}/api/vendor-cart`, {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
              productId,
              quantity
          })
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error(data.message || "Failed to add item to cart");
      }

      window.showOverlay && showOverlay({ type:'success', title:'Added', message:'Item added to cart!' });
      // Optional: You could trigger a small cart badge update here

  } catch (error) {
      console.error("Error adding to cart:", error);
      window.showOverlay && showOverlay({ type:'error', title:'Error', message: error.message || 'Something went wrong' });
  }
}
