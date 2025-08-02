document.addEventListener('DOMContentLoaded', () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');
  const agent = JSON.parse(localStorage.getItem('vendplugAgent'));

  if (!agent || !agent.token) {
    alert('Unauthorized. Please log in again.');
    window.location.href = '/agent-login.html';
    return;
  }

  const token = agent.token;

  // Load wallet data initially
  fetchWallet();
  fetchTransactions();

  // Date filter button
  document.getElementById('filterBtn')?.addEventListener('click', () => {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    fetchTransactions(start, end);
  });

  async function fetchWallet() {
    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/agent`, {
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

      data.transactions.forEach(txn => {
        const isSender = txn.from === data.accountNumber;
        const direction = isSender ? 'Sent to' : 'Received from';
        const otherParty = isSender ? txn.to : txn.from;
        const name = txn.initiatedBy?.name || 'Unknown';

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
          <div class="transaction-direction">${direction}: ${otherParty}</div>
          <div class="transaction-meta">
            Ref: ${txn.ref}<br />
            Status: ${txn.status}<br />
            By: ${name}<br />
            Balance After: ₦${txn.balanceAfter?.toLocaleString() || 'N/A'}<br />
            Date: ${new Date(txn.createdAt).toLocaleString()}
          </div>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      console.error('Error fetching transactions:', err);
      document.getElementById('transactionsList').innerHTML = '<p>Error loading transactions.</p>';
    }
  }

  async function resolveUser() {
    const acct = document.getElementById('recipientAccount').value.trim();
    const display = document.getElementById('userNameResolved');
    if (!acct) return (display.textContent = '');

    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/lookup/${acct}`);
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

  async function handlePayout() {
    const amount = Number(document.getElementById('payoutAmount').value);
    if (!amount || amount <= 0) {
      alert('Please enter a valid payout amount');
      return;
    }

    try {
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/payout`, {
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

  // Global scope
  window.handleTransfer = handleTransfer;
  window.handlePayout = handlePayout;
  window.resolveUser = resolveUser;
});
