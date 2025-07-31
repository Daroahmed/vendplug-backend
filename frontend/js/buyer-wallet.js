document.addEventListener('DOMContentLoaded', async () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');

  const buyer = JSON.parse(localStorage.getItem('vendplugBuyer'));

  if (!buyer || !buyer.token) {
    alert('Unauthorized. Please log in again.');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch('/api/wallet/buyer', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${buyer.token}`
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
