document.addEventListener('DOMContentLoaded', async () => {
    const agentId = new URLSearchParams(window.location.search).get('agent');
  
    if (!agentId) {
      alert('Agent ID is missing from the URL');
      return;
    }
  
    const agentProfileEl = document.getElementById('agentProfile');
    const agentProductsEl = document.getElementById('agentProducts');
  
    try {
      // Fetch agent profile
      const agentRes = await fetch(`/api/agents/${agentId}`);
      const agent = await agentRes.json();
  
      if (!agent || !agent.fullName) {
        agentProfileEl.innerHTML = '<p>Agent not found.</p>';
        return;
      }
  
      agentProfileEl.innerHTML = `
        <div class="shop-info">
          <h2>${agent.fullName}</h2>
          <p><strong>Phone:</strong> <a class="whatsapp-link" href="https://wa.me/${agent.phoneNumber}" target="_blank">${agent.phoneNumber}</a></p>
          <p><strong>Address:</strong> ${agent.businessAddress || 'Not provided'}</p>
          <p><strong>State:</strong> ${agent.state || 'Not specified'}</p>
          <p><strong>Account Number:</strong> 
            <span id="agentAccount">${agent.virtualAccount || 'Not set'}</span>
            <button class="copy-btn" onclick="copyAccount()">Copy</button>
          </p>
          <p><strong>Total Transactions:</strong> ${agent.totalSales || 0}</p>
        </div>
      `;
  
      // Fetch agent products
      console.log("Loading shop for agent:", agentId);
      const productsRes = await fetch(`/api/agent-products/agent/${agentId}`);
      const products = await productsRes.json();
  
      if (!products || products.length === 0) {
        agentProductsEl.innerHTML = '<p>No products for this agent yet.</p>';
        return;
      }
  
      agentProductsEl.innerHTML = products.map(product => `
        <div class="product-card" onclick="window.location.href='/view-shop-view.html?product=${product._id}'">
          <img src="${product.image || '/placeholder.png'}" alt="${product.name}" />
          <h4>${product.name}</h4>
          <p>₦${product.price.toLocaleString()}</p>
        </div>
      `).join('');
  
    } catch (error) {
      console.error('Error loading agent data:', error);
      agentProfileEl.innerHTML = '<p>Error loading agent data.</p>';
      agentProductsEl.innerHTML = '';
    }
  });
  
  // Copy account number function
  function copyAccount() {
    const accountNumber = document.getElementById('agentAccount').innerText;
    navigator.clipboard.writeText(accountNumber).then(() => {
      alert('Account number copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }
  