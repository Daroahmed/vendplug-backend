document.addEventListener('DOMContentLoaded', () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');
  const buyer = JSON.parse(localStorage.getItem('vendplugBuyer'));

  if (!buyer || !buyer.token) {
    alert('Unauthorized. Please log in again.');
    window.location.href = '/buyer-login.html';
    return;
  }

  const token = buyer.token;
  const resolvedNameEl = document.getElementById('resolvedName');

  fetchWallet();
  fetchTransactions();

  document.getElementById('filterBtn')?.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    fetchTransactions(start, end);
  });

  async function fetchWallet() {
    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/buyer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      accountNumberEl.textContent = data.virtualAccount || 'Not available';
      balanceEl.textContent = Number(data.balance || 0).toLocaleString('en-NG');
    } catch (err) {
      accountNumberEl.textContent = 'Error';
      balanceEl.textContent = 'Error';
    }
  }

  async function fetchTransactions(startDate = '', endDate = '') {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`${window.BACKEND_URL}/api/wallet/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch');
      }

      const data = await res.json();
      const container = document.getElementById('transactionsList');
      container.innerHTML = '';

      if (!Array.isArray(data.transactions)) {
        throw new Error('Missing transaction data');
      }

      if (!data.transactions.length) {
        container.innerHTML = '<p>No transactions found for selected period.</p>';
        return;
      }

      const nameCache = {};

      for (const txn of data.transactions) {
        const isSender = txn.from === data.accountNumber;
        const otherAccount = isSender ? txn.to : txn.from;
        const direction = isSender ? 'Sent to' : 'Received from';

        if (!nameCache[otherAccount]) {
          try {
            const lookupRes = await fetch(`${window.BACKEND_URL}/api/wallet/lookup/${otherAccount}`);
            const lookupData = await lookupRes.json();
            nameCache[otherAccount] =
              lookupData.user?.fullName ||
              lookupData.user?.name ||
              lookupData.user?.businessName ||
              'Unknown';
          } catch {
            nameCache[otherAccount] = 'Unknown';
          }
        }

        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
          <div class="transaction-header">
            <div class="transaction-type ${txn.status === 'failed' ? 'transaction-failed' : 'transaction-success'}">
              ${txn.type}
            </div>
            <div class="transaction-amount">
              ₦${txn.amount.toLocaleString()}
            </div>
          </div>
          <div class="transaction-direction">${direction}: ${nameCache[otherAccount]} (${otherAccount})</div>
          <div class="transaction-meta">
            Ref: ${txn.ref}<br />
            Status: ${txn.status}<br />
            By: ${txn.initiatorType || 'N/A'}<br />
            Date: ${new Date(txn.createdAt).toLocaleString()}
          </div>
        `;
        container.appendChild(card);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      document.getElementById('transactionsList').innerHTML = '<p>Error loading transactions.</p>';
    }
  }

  async function resolveUser() {
    const acct = document.getElementById('recipientAccount').value.trim();
    const display = document.getElementById('userNameResolved');
    resolvedNameEl.value = '';
    display.textContent = '🔍 Resolving...';

    if (!acct) {
      display.textContent = '';
      return;
    }

    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/lookup/${acct}`);
      const data = await res.json();

      const name =
        data.user?.fullName || data.user?.name || data.user?.businessName;

      if (name && data.role) {
        display.textContent = `✅ Recipient: ${name} (${data.role})`;
        resolvedNameEl.value = name;
      } else {
        display.textContent = '❌ User not found';
      }
    } catch {
      display.textContent = '⚠️ Error resolving account number';
    }
  }

  async function handleTransfer() {
    const acct = document.getElementById('recipientAccount').value.trim();
    const amount = Number(document.getElementById('transferAmount').value);
    if (!acct || amount <= 0) return alert('Enter valid account and amount');

    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fromAccountNumber: accountNumberEl.textContent.trim(),
          toAccountNumber: acct,
          amount,
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


  // Global
  window.handleTransfer = handleTransfer;
  window.resolveUser = resolveUser;
});
