document.addEventListener('DOMContentLoaded', () => {
  const accountNumberEl = document.getElementById('accountNumber');
  const balanceEl = document.getElementById('balance');
  const vendor = getCurrentUser();
  const token = getAuthToken();
  
  // Store actual balance for toggle functionality
  let actualBalance = '0';

  if (!vendor || !token) {
    window.showOverlay && showOverlay({ type:'error', title:'Unauthorized', message:'Please log in again.' });
    redirectToLogin();
    return;
  }
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
      const res = await fetch(`${window.BACKEND_URL}/api/wallet/vendor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      accountNumberEl.textContent = data.virtualAccount || 'Not available';
      actualBalance = Number(data.balance || 0).toLocaleString('en-NG');
      balanceEl.textContent = actualBalance;
      // Expose balance globally for toggle function
      window.actualBalance = actualBalance;
    } catch (err) {
      accountNumberEl.textContent = 'Error';
      balanceEl.textContent = 'Error';
      actualBalance = 'Error';
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

        let displayName = '';
        if (!isSender && txn.initiatorName && txn.initiatorName !== 'Unknown') {
          displayName = txn.initiatorName;
        } else {
          const acctLower = (otherAccount || '').toString().toLowerCase();
          const knownMap = { escrow: 'Escrow', paystack: 'Paystack', system: 'System', platform: 'VendPlug', vendplug: 'VendPlug' };
          if (knownMap[acctLower]) displayName = knownMap[acctLower];

          if (!displayName && typeof txn.ref === 'string') {
            const refUpper = txn.ref.toUpperCase();
            if (refUpper.includes('PAYSTACK')) displayName = 'Paystack';
            if (refUpper.includes('VENDPLUG')) displayName = 'VendPlug';
          }

          if (!displayName && txn.initiatorType) displayName = txn.initiatorType;

          if (!displayName) {
            if (!nameCache[otherAccount]) {
              try {
                const lookupRes = await fetch(`${window.BACKEND_URL}/api/wallet/lookup/${otherAccount}`);
                const lookupData = await lookupRes.json();
                nameCache[otherAccount] =
                  lookupData.user?.fullName ||
                  lookupData.user?.name ||
                  lookupData.user?.businessName ||
                  '';
              } catch {
                nameCache[otherAccount] = '';
              }
            }
            displayName = nameCache[otherAccount] || '';
          }
        }
        if (!displayName) displayName = 'Unknown';

        // Determine transaction type display
        let transactionTypeDisplay = txn.type;
        if (txn.ref && txn.ref.includes('DISP_ESCROW')) {
          if (txn.ref.includes('WIN')) {
            transactionTypeDisplay = 'Dispute Resolution Credit';
          } else if (txn.ref.includes('PARTIAL')) {
            transactionTypeDisplay = 'Partial Dispute Credit';
          } else {
            transactionTypeDisplay = 'Dispute Resolution';
          }
        } else if (txn.ref && txn.ref.includes('PAYSTACK')) {
          transactionTypeDisplay = 'Wallet Funding';
        }

        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
          <div class="transaction-header">
            <div class="transaction-type ${txn.status === 'failed' ? 'transaction-failed' : 'transaction-success'}">
              ${transactionTypeDisplay}
            </div>
            <div class="transaction-amount">
              ₦${txn.amount.toLocaleString()}
            </div>
          </div>
          <div class="transaction-direction">${direction}: ${displayName} (${otherAccount})</div>
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

  // Transfer/resolve removed
});
