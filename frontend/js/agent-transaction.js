const API_BASE = '/api';
const token = localStorage.getItem('vendplug-token');

// Load wallet balance
window.addEventListener('DOMContentLoaded', async () => {
  await loadWalletBalance();
});

async function loadWalletBalance() {
  try {
    const res = await fetch(`${API_BASE}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    document.getElementById('wallet-balance').textContent = data.balance.toLocaleString();
  } catch (err) {
    alert('Failed to load wallet balance');
  }
}

// Transfer to vendor
document.getElementById('transfer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const accountNumber = document.getElementById('recipient-account').value;
  const amount = parseFloat(document.getElementById('transfer-amount').value);

  if (!accountNumber || !amount || amount <= 0) return;

  try {
    const res = await fetch(`${API_BASE}/transactions/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ toAccountNumber: accountNumber, amount })
    });
    const data = await res.json();
    document.getElementById('transfer-status').textContent = data.message;
    await loadWalletBalance();
  } catch (err) {
    document.getElementById('transfer-status').textContent = 'Transfer failed.';
  }
});

// Load transactions
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
