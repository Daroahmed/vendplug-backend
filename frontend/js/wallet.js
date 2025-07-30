document.addEventListener('DOMContentLoaded', async () => {
    const walletBalanceEl = document.getElementById('wallet-balance');
    const accountNumberEl = document.getElementById('account-number');
    const bankNameEl = document.getElementById('bank-name');
    const accountNameEl = document.getElementById('account-name');
  
    let endpoint = '';
    let token = '';
  
    const path = window.location.pathname;
  
    if (path.includes('buyer')) {
      endpoint = '/api/wallet/buyer/balance';
      token = localStorage.getItem('vendplug-token-buyer');
    } else if (path.includes('agent')) {
      endpoint = '/api/wallet/agent/balance';
      token = localStorage.getItem('vendplug-token-agent');
    } else if (path.includes('vendor')) {
      endpoint = '/api/wallet/vendor/balance';
      token = localStorage.getItem('vendplug-token-vendor');
    } else {
      console.error('Unknown role page. Cannot determine endpoint.');
      return;
    }
  
    if (!token) {
      console.error('Token missing. Please log in again.');
      return;
    }
  
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch wallet data');
      }
  
      const data = await response.json();

      const { balance, virtualAccount } = await response.json();

    if (walletBalanceEl) walletBalanceEl.textContent = `₦${balance.toLocaleString()}`;
    if (accountNumberEl) accountNumberEl.textContent = virtualAccount?.accountNumber || 'N/A';
    if (bankNameEl) bankNameEl.textContent = virtualAccount?.bankName || 'N/A';
    if (accountNameEl) accountNameEl.textContent = virtualAccount?.accountName || 'N/A';

  
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  });
  