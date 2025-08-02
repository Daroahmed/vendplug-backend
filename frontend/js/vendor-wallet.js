document.addEventListener('DOMContentLoaded', () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');
  const vendor = JSON.parse(localStorage.getItem('vendplugVendor'));

  if (!vendor || !vendor.token) {
    alert('Unauthorized. Please log in again.');
    window.location.href = '/vendor-login.html';
    return;
  }

  const token = vendor.token;

  fetchWallet();
  fetchTransactions();

  document.getElementById('recipientAccount').addEventListener('blur', resolveUser);

  async function fetchWallet() {
    try {
      const res = await fetch('/api/wallet/vendor', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      accountNumberEl.textContent = data.virtualAccount || 'Not available';
      balanceEl.textContent = Number(data.balance).toLocaleString('en-NG');
    } catch (err) {
      accountNumberEl.textContent = 'Error';
      balanceEl.textContent = 'Error';
    }
  }

  async function resolveUser() {
    const acct = document.getElementById('recipientAccount').value.trim();
    const display = document.getElementById('userNameResolved');
    if (!acct) return (display.textContent = '');

    try {
      const res = await fetch(`/api/wallet/lookup/${acct}`);
      const data = await res.json();

      if (data.userType && data.user && data.user.name) {
        display.textContent = `Recipient: ${data.user.name} (${data.userType})`;
      } else {
        display.textContent = 'User not found';
      }
    } catch {
      display.textContent = 'Error resolving user';
    }
  }

  async function handleTransfer() {
    const acct = document.getElementById('recipientAccount').value.trim();
    const amount = Number(document.getElementById('transferAmount').value);

    if (!acct || amount <= 0) return alert('Enter valid account and amount');

    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAccountNumber: accountNumberEl.textContent.trim(),
          toAccountNumber: acct,
          amount
        }),
        
      });
      const data = await res.json();
      alert(data.message || 'Transfer successful');
      fetchWallet();
      fetchTransactions();
    } catch {
      alert('Transfer failed');
    }
  }

  async function handlePayout() {
    const amount = Number(document.getElementById('payoutAmount').value);

    if (!amount || amount <= 0) {
      alert('Please enter a valid payout amount');
      return;
    }

    try {
      const res = await fetch('/api/wallet/payout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      alert(data.message || 'Payout requested');
      fetchWallet();
      fetchTransactions();
    } catch (err) {
      alert('Payout failed');
      console.error(err);
    }
  }

  async function fetchTransactions() {
    const accountNumber = accountNumberEl?.textContent?.trim();
    if (!accountNumber || accountNumber === 'Error') return;

    try {
      
      const BACKEND_URL = (await import('./config.js'))
      const res = await fetch(`${BACKEND_URL}/api/wallet/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await res.json();
      const list = document.getElementById('transactionsList');
      list.innerHTML = '';

      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        data.transactions.forEach(txn => {
          const li = document.createElement('li');
          li.textContent = `${txn.type?.toUpperCase?.()} - ₦${Number(txn.amount).toLocaleString()} - ${new Date(txn.createdAt).toLocaleString()}`;
          list.appendChild(li);
        });
      } else {
        list.innerHTML = '<li>No transactions found</li>';
      }
    } catch {
      document.getElementById('transactionsList').innerHTML = '<li>Error loading transactions</li>';
    }
  }

  window.handleTransfer = handleTransfer;
  window.handlePayout = handlePayout;
  window.resolveUser = resolveUser;
});
