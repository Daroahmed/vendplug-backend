const token = localStorage.getItem('vendplug-token'); // consistent token naming
const role = localStorage.getItem('role');

// Redirect to login if no token or not an agent
if (!token || role !== 'agent') {
  window.location.href = '/agent-login.html';
}

// Greet agent
const name = localStorage.getItem('name');
if (name) {
  document.querySelector('.greeting strong').innerText = name;
}

// Load stats securely
fetch('/api/agents/stats', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(res => {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Invalid or expired token
      alert('Your session has expired. Please log in again.');
      localStorage.removeItem('vendplug-token');
      localStorage.removeItem('role');
      localStorage.removeItem('name');
      window.location.href = '/agent-login.html';
    } else {
      throw new Error(`Failed to load stats. Status: ${res.status}`);
    }
  }
  return res.json();
})
.then(data => {
  const [ordersEl, pickupsEl, earningsEl] = document.querySelectorAll('.card h3');

  ordersEl.innerText = data.ordersToday || '0';
  pickupsEl.innerText = data.pendingPickups || '0';
  earningsEl.innerText = `₦${(data.earnings || 0).toFixed(2)}`;
})
.catch(err => {
  console.error('❌ Error loading agent stats:', err.message);
  alert('Failed to load stats. Please try again later.');
});
