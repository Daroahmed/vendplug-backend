const token = localStorage.getItem('vendplug-token');
const API_BASE = '/api';

// Load balance on page load
window.addEventListener('DOMContentLoaded', () => {
  loadVendorWallet();
});

async function loadVendorWallet() {
  try {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    document.getElementById('wallet-balance').textContent = data.balance.toLocaleString();
  } catch (err) {
    alert('Failed to load wallet');
  }
}

// Load vendor transactions
document.getElementById('load-transactions').addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_BASE}/transactions/my-transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const transactions = await res.json();
    const list = document.getElementById('transaction-list');
    list.innerHTML = '';

    transactions.forEach(tx => {
      const li = document.createElement('li');
      li.textContent = `₦${tx.amount} - ${tx.type} - ${new Date(tx.createdAt).toLocaleString()}`;
      list.appendChild(li);
    });
  } catch (err) {
    alert('Could not load transactions');
  }
});

// Optional: Payout logic
/*
document.getElementById('payout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const bankAccount = document.getElementById('bank-account').value;
  const amount = parseFloat(document.getElementById('payout-amount').value);
  if (!bankAccount || !amount || amount <= 0) return;

  try {
    const res = await fetch(`${API_BASE}/wallet/request-payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ bankAccount, amount })
    });

    const data = await res.json();
    document.getElementById('payout-status').textContent = data.message;
    await loadVendorWallet();
  } catch (err) {
    document.getElementById('payout-status').textContent = 'Payout failed.';
  }
});
*/
