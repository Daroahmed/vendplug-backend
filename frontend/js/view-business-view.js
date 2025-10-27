let allReviews = [];
let currentReviewIndex = 0;
const reviewsPerPage = 5;
let currentProduct = null;
let agentId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  if (!productId) return;

  try {
    const res = await fetch(`/api/agent-products/public/${productId}`);
    if (!res.ok) throw new Error("Failed to fetch product");
    const product = await res.json();
    currentProduct = product;
    agentId = product.agent._id;

    loadProductDetails(product);
    loadAgentDetails(agentId);

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
    const hint = available <= 5 ? `<span style=\"margin-left:8px;color: var(--muted);font-size:0.9rem;\">Only ${available} available</span>` : '';
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
}

async function loadAgentDetails(agentId) {
  try {
    const res = await fetch(`/api/agents/${agentId}`);
    if (!res.ok) throw new Error("Failed to fetch agent");
    const agent = await res.json();

    // Store all reviews
    allReviews = agent.reviews || [];

    // Show average rating
    const reviewsContainer = document.getElementById('reviewsContainer');
    const avgRating = agent.averageRating ? agent.averageRating.toFixed(1) : "0.0";
    reviewsContainer.innerHTML = `<h4>Average Rating: ${avgRating} ★</h4>`;

    // Load first batch
    displayMoreReviews();

    // Show load more button if needed
    if (allReviews.length > reviewsPerPage) {
      document.getElementById('loadMoreReviewsBtn').style.display = 'block';
      document.getElementById('loadMoreReviewsBtn').addEventListener('click', displayMoreReviews);
    }

    // Handle review filtering and sorting
    document.getElementById('reviewFilter').addEventListener('change', loadFilteredAgentReviews);
    document.getElementById('reviewSort').addEventListener('change', loadFilteredAgentReviews);
    document.getElementById('ratingFilter').addEventListener('change', loadFilteredAgentReviews);

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

        const reviewRes = await fetch(`/api/agents/${agentId}/reviews`, {
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
    console.error("Error loading agent details:", err);
  }
}

function displayMoreReviews() {
  const container = document.getElementById('reviewsContainer');
  const endIndex = currentReviewIndex + reviewsPerPage;

  allReviews.slice(currentReviewIndex, endIndex).forEach(r => {
    const div = document.createElement('div');
    div.className = 'review';
    div.innerHTML = createReviewHTML(r);
    container.appendChild(div);
  });

  currentReviewIndex = endIndex;

  // Hide button if no more reviews
  if (currentReviewIndex >= allReviews.length) {
    document.getElementById('loadMoreReviewsBtn').style.display = 'none';
  }
}

function createReviewHTML(review) {
  const verifiedBadge = review.isVerifiedPurchase ? 
    '<span class="verified-badge"><i class="fas fa-check-circle"></i> Verified Purchase</span>' : '';
  
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const date = new Date(review.createdAt).toLocaleDateString();
  
  // Get buyer name with fallbacks
  const buyerName = review.buyerName || 
                   review.buyer?.fullName || 
                   review.buyer?.name || 
                   'Anonymous';
  
  return `
    <div class="review-header">
      <div class="reviewer-info">
        <strong class="reviewer-name">${buyerName}</strong>
        ${verifiedBadge}
      </div>
      <div class="review-meta">
        <span class="review-rating">${stars} (${review.rating}/5)</span>
        <span class="review-date">${date}</span>
      </div>
    </div>
    <div class="review-content">
      <p>${review.comment}</p>
    </div>
    <div class="review-actions">
      <button class="helpful-btn" onclick="voteAgentReview('${review._id}', 'helpful')">
        <i class="fas fa-thumbs-up"></i> Helpful (${review.helpfulVotes || 0})
      </button>
      <button class="not-helpful-btn" onclick="voteAgentReview('${review._id}', 'not_helpful')">
        <i class="fas fa-thumbs-down"></i> Not Helpful (${review.notHelpfulVotes || 0})
      </button>
      <button class="report-btn" onclick="reportAgentReview('${review._id}')">
        <i class="fas fa-flag"></i> Report
      </button>
    </div>
  `;
}

// Agent Review voting function
async function voteAgentReview(reviewId, voteType) {
  const token = getAuthToken();
  if (!token) {
    window.showOverlay && showOverlay({ type:'error', title:'Login required', message:'Please log in to vote on reviews.' });
    return;
  }

  try {
    const response = await fetch(`/api/agents/${agentId}/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ voteType })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to vote on review');
    }

    const data = await response.json();
    
    // Update the vote counts in the UI
    const reviewElement = document.querySelector(`[onclick*="${reviewId}"]`).closest('.review');
    const helpfulBtn = reviewElement.querySelector('.helpful-btn');
    const notHelpfulBtn = reviewElement.querySelector('.not-helpful-btn');
    
    if (helpfulBtn) {
      helpfulBtn.innerHTML = `<i class="fas fa-thumbs-up"></i> Helpful (${data.helpfulVotes})`;
    }
    if (notHelpfulBtn) {
      notHelpfulBtn.innerHTML = `<i class="fas fa-thumbs-down"></i> Not Helpful (${data.notHelpfulVotes})`;
    }

    window.showOverlay && showOverlay({ type:'success', title:'Thank you!', message:'Your vote has been recorded.' });
  } catch (error) {
    console.error('Error voting on review:', error);
    window.showOverlay && showOverlay({ type:'error', title:'Error', message: error.message || 'Failed to vote on review' });
  }
}

// Agent Review reporting function
async function reportAgentReview(reviewId) {
  const reason = prompt('Please select a reason for reporting this review:\n1. Spam\n2. Inappropriate content\n3. Fake review\n4. Offensive language\n5. Other\n\nEnter the number (1-5):');
  
  if (!reason || reason < 1 || reason > 5) {
    return;
  }

  const reasons = ['spam', 'inappropriate', 'fake', 'offensive', 'other'];
  const selectedReason = reasons[reason - 1];

  const token = getAuthToken();
  if (!token) {
    window.showOverlay && showOverlay({ type:'error', title:'Login required', message:'Please log in to report reviews.' });
    return;
  }

  try {
    const response = await fetch(`/api/agents/${agentId}/reviews/${reviewId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ reason: selectedReason })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to report review');
    }

    window.showOverlay && showOverlay({ type:'success', title:'Thank you!', message:'Review has been reported for review.' });
  } catch (error) {
    console.error('Error reporting review:', error);
    window.showOverlay && showOverlay({ type:'error', title:'Error', message: error.message || 'Failed to report review' });
  }
}

// Load filtered and sorted agent reviews
async function loadFilteredAgentReviews() {
  const filter = document.getElementById('reviewFilter').value;
  const sort = document.getElementById('reviewSort').value;
  const rating = document.getElementById('ratingFilter').value;
  
  try {
    const params = new URLSearchParams({
      filter,
      sort,
      rating,
      page: 1,
      limit: 10
    });
    
    const response = await fetch(`/api/agents/${agentId}/reviews?${params}`);
    if (!response.ok) throw new Error('Failed to fetch filtered reviews');
    
    const data = await response.json();
    
    // Clear current reviews
    const container = document.getElementById('reviewsContainer');
    container.innerHTML = '';
    
    // Reset pagination
    currentReviewIndex = 0;
    allReviews = data.reviews;
    
    // Display filtered reviews
    displayMoreReviews();
    
    // Update load more button
    if (allReviews.length > reviewsPerPage) {
      document.getElementById('loadMoreReviewsBtn').style.display = 'block';
    } else {
      document.getElementById('loadMoreReviewsBtn').style.display = 'none';
    }
    
  } catch (error) {
    console.error('Error loading filtered reviews:', error);
    window.showOverlay && showOverlay({ type:'error', title:'Error', message: 'Failed to load filtered reviews' });
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
      const response = await fetch(`${window.BACKEND_URL}/api/agent-cart`, {
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
