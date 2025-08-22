document.addEventListener('DOMContentLoaded', async () => {
  const vendorId = new URLSearchParams(window.location.search).get('vendor');

  if (!vendorId) {
    alert('Vendor ID is missing from the URL');
    return;
  }

  const vendorProfileEl = document.getElementById('vendorProfile');
  const vendorProductsEl = document.getElementById('vendorProducts');

  try {
    // Fetch vendor profile
    const vendorRes = await fetch(`/api/vendors/${vendorId}`);
    const vendor = await vendorRes.json();

    if (!vendor || !vendor.fullName) {
      vendorProfileEl.innerHTML = '<p>Vendor not found.</p>';
      return;
    }

    vendorProfileEl.innerHTML = `
      <div class="shop-info">
        <h2>${vendor.fullName}</h2>
        <p><strong>Phone:</strong> <a class="whatsapp-link" href="https://wa.me/${vendor.phoneNumber}" target="_blank">${vendor.phoneNumber}</a></p>
        <p><strong>Address:</strong> ${vendor.businessAddress || 'Not provided'}</p>
        <p><strong>State:</strong> ${vendor.state || 'Not specified'}</p>
        <p><strong>Account Number:</strong> 
          <span id="vendorAccount">${vendor.virtualAccount || 'Not set'}</span>
          <button class="copy-btn" onclick="copyAccount()">Copy</button>
        </p>
        <p><strong>Total Transactions:</strong> ${vendor.totalSales || 0}</p>
      </div>
    `;

    // Fetch vendor products
    console.log("Loading shop for vendor:", vendorId);
    const productsRes = await fetch(`/api/vendor-products/vendor/${vendorId}`);
    const products = await productsRes.json();

    if (!products || products.length === 0) {
      vendorProductsEl.innerHTML = '<p>No products for this vendor yet.</p>';
      return;
    }

    vendorProductsEl.innerHTML = products.map(product => `
      <div class="product-card" onclick="window.location.href='/view-shop-view.html?product=${product._id}'">
        <img src="${product.image || '/placeholder.png'}" alt="${product.name}" />
        <h4>${product.name}</h4>
        <p>₦${product.price.toLocaleString()}</p>
      </div>
    `).join('');

  } catch (error) {
    console.error('Error loading vendor data:', error);
    vendorProfileEl.innerHTML = '<p>Error loading vendor data.</p>';
    vendorProductsEl.innerHTML = '';
  }
});

// Copy account number function
function copyAccount() {
  const accountNumber = document.getElementById('vendorAccount').innerText;
  navigator.clipboard.writeText(accountNumber).then(() => {
    alert('Account number copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
  });
}
