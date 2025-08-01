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

  async function fetchWallet() {
    try {
      const res = await fetch('/api/wallet/agent', {
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

  async function fetchWalletData(start = '', end = '') {
    const accountNumber = accountNumberEl?.textContent?.trim();
    if (!accountNumber || accountNumber === 'Error' || accountNumber === 'Not available') return;

    try {
      const params = new URLSearchParams();
      if (start) params.append('startDate', start);
      if (end) params.append('endDate', end);

      const res = await fetch(`/api/wallet/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      const container = document.getElementById('transactionsList');
      container.innerHTML = '';

      if (!data.transactions?.length) {
        container.innerHTML = '<p>No transactions found for selected period.</p>';
        return;
      }

      data.transactions.forEach(txn => {
        const isSender = txn.from === accountNumber;
        const direction = isSender ? 'Sent to' : 'Received from';
        const otherParty = isSender ? txn.to : txn.from;

        const txnCard = document.createElement('div');
        txnCard.className = 'transaction-card';

        txnCard.innerHTML = `
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
            Balance After: ₦${txn.balanceAfter?.toLocaleString() || 'N/A'}<br />
            Date: ${new Date(txn.createdAt).toLocaleString()}
          </div>
        `;

        container.appendChild(txnCard);
      });
    } catch (err) {
      console.error('Error loading wallet data:', err);
      document.getElementById('transactionsList').innerHTML = '<p>Error loading transactions</p>';
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
      fetchWalletData(); // reload transactions
    } catch {
      alert('Transfer failed');
    }
  }

  async function handlePayout() {
    const amount = Number(document.getElementById('payoutAmount').value);
    if (!amount || amount <= 0) return alert('Please enter a valid payout amount');

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
      fetchWalletData(); // reload transactions
    } catch (err) {
      alert('Payout failed');
      console.error(err);
    }
  }

  // Filter form listener
  document.getElementById('filterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    fetchWalletData(start, end);
  });

  document.getElementById('recipientAccount').addEventListener('blur', resolveUser);

  window.handleTransfer = handleTransfer;
  window.handlePayout = handlePayout;

  // Initial load
  fetchWallet().then(() => fetchWalletData());
});
