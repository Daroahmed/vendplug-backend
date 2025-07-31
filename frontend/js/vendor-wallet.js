document.addEventListener('DOMContentLoaded', async () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');

  const vendor = JSON.parse(localStorage.getItem('vendplugVendor'));

  if (!vendor || !vendor.token) {
    alert('Unauthorized. Please log in again.');
    window.location.href = '/vendor-login.html';
    return;
  }

  try {
    const response = await fetch('/api/wallet/vendor', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vendor.token}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch wallet');

    const data = await response.json();
    accountNumberEl.textContent = data.virtualAccount || 'Not available';
    balanceEl.textContent = Number(data.balance).toLocaleString('en-NG');
  } catch (err) {
    console.error('Error loading wallet:', err);
    accountNumberEl.textContent = 'Error';
    balanceEl.textContent = 'Error';
  }
});
