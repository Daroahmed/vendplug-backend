document.addEventListener('DOMContentLoaded', () => {
  const vendor = getCurrentUser();
  const token = getAuthToken();
  const BACKEND = window.BACKEND_URL || "";

  if (!token) {
    alert('Unauthorized. Please log in again.');
    redirectToLogin();
    return;
  }

  const addProductForm = document.getElementById('addProductForm');
  const productList = document.getElementById('productList');
  const categorySelect = document.getElementById('productCategory');

  // 👇 Load category
  if (categorySelect && vendor?.category) {
    categorySelect.innerHTML = `<option value="${vendor.category}" selected>${vendor.category}</option>`;
  } else {
    categorySelect.innerHTML = `<option value="" selected>No category found</option>`;
  }

  fetchVendorProducts();

  // ✅ Form submission
  addProductForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitProduct();
  });

  async function submitProduct() {
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value;
    const price = Number(document.getElementById('productPrice').value);
    const description = document.getElementById('productDescription').value;
    const stock = Number(document.getElementById('productStock').value);
    const category = vendor?.category;
    const imageFile = document.getElementById('productImage').files[0];

    if (!category) return alert('Vendor category is missing');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('description', description);
    formData.append('stock', stock);
    formData.append('category', category);
    if (imageFile) formData.append('productImage', imageFile);

    const endpoint = id
      ? `${BACKEND}/api/vendor-products/update/${id}`
      : `${BACKEND}/api/vendor-products`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Upload failed');

      resetForm();
      await fetchVendorProducts();
      alert(id ? '✅ Product updated' : '✅ Product added');
    } catch (err) {
      console.error(err);
      alert('❌ ' + err.message);
    }
  }

  async function fetchVendorProducts() {
    try {
      const res = await fetch(`${BACKEND}/api/vendor-products/mine`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const products = await res.json();
  
      productList.innerHTML = '';
      if (!Array.isArray(products) || !products.length) {
        productList.innerHTML = '<p>No products found.</p>';
        return;
      }
  
      products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          ${product.image ? `<img src="${product.image}" style="width:100%; border-radius:8px;" />` : ''}
          <h3>${product.name}</h3>
          <p>₦${product.price.toLocaleString()}</p>
          <p>Stock: ${product.stock ?? 'Not specified'}</p>
          <p>Category: ${product.category}</p>
          <p>${product.description || ''}</p>
          <div class="product-actions">
            <button class="edit-btn" onclick='editProduct(${JSON.stringify(product)})'>Edit</button>
            <button class="delete-btn" onclick='deleteProduct("${product._id}")'>Delete</button>
          </div>
        `;
        productList.appendChild(card);
      });
    } catch (err) {
      console.error(err);
      productList.innerHTML = '<p>Error loading products.</p>';
    }
  }
  
  // ✅ Delete product — fixed to access BACKEND/token
  async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`${BACKEND}/api/vendor-products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Delete failed');

      await fetchVendorProducts();
      alert('✅ Product deleted');
    } catch (err) {
      console.error(err);
      alert('❌ Failed to delete product: ' + err.message);
    }
  }

  function resetForm() {
    addProductForm.reset();
    document.getElementById('productId').value = '';
    const oldPreview = document.getElementById('currentImagePreview');
    if (oldPreview) oldPreview.remove();
  }

  // Optional: scroll to form when editing
  window.editProduct = function(prod) {
    document.getElementById('formTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = prod._id;
    document.getElementById('productName').value = prod.name;
    document.getElementById('productPrice').value = prod.price;
    document.getElementById('productDescription').value = prod.description || '';
    document.getElementById('productStock').value = prod.stock || 0;

    const oldPreview = document.getElementById('currentImagePreview');
    if (oldPreview) oldPreview.remove();

    if (prod.image) {
      const imgPreview = document.createElement('img');
      imgPreview.id = 'currentImagePreview';
      imgPreview.src = prod.image;
      imgPreview.style = 'width:100%; border-radius:6px; margin-top:10px;';
      document.getElementById('productImage').insertAdjacentElement('afterend', imgPreview);
    }

    // Scroll to form
    document.querySelector('.product-form')?.scrollIntoView({ behavior: 'smooth' });
  };
  window.deleteProduct = deleteProduct

});
