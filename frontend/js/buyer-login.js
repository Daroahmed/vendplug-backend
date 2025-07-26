document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const messageEl = document.getElementById('message');

  try {
    const res = await fetch('/api/buyers/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    console.log('🔍 Full backend response:', data);
    console.log('🔍 Status code:', res.status);

    if (res.ok && data.token && data._id) {
      localStorage.setItem('vendplug-token', data.token);
      localStorage.setItem('vendplugBuyer', JSON.stringify(data));
      messageEl.textContent = data.message || 'Login successful';
      messageEl.style.color = 'green';
      setTimeout(() => (window.location.href = '/buyer-home.html'), 1000);
    } else {
      messageEl.textContent = data.message || 'Login failed';
      messageEl.style.color = 'red';
    }

  } catch (err) {
    console.error('❌ Error during login:', err);
    messageEl.textContent = 'Login failed. Please try again.';
    messageEl.style.color = 'red';
  }
});
