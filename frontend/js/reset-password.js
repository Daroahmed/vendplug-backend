console.log("✅ reset-password.js loaded");

const BACKEND = window.BACKEND_URL || "";

const requestResetForm = document.getElementById('requestResetForm');
const newPasswordForm = document.getElementById('newPasswordForm');
const messageEl = document.getElementById('resetMessage');

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Show appropriate form based on token presence
if (token) {
    requestResetForm.style.display = 'none';
    newPasswordForm.style.display = 'block';
} else {
    requestResetForm.style.display = 'block';
    newPasswordForm.style.display = 'none';
}

// Handle password reset request
requestResetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value;
    const userType = document.getElementById('userRole').value;

    try {
        const res = await fetch(`${BACKEND}/api/auth/request-reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, userType })
        });

        const data = await res.json();

        if (res.ok) {
            messageEl.textContent = 'Password reset email sent! Please check your inbox';
            messageEl.style.color = 'green';
            // Store email and role for potential resend
            localStorage.setItem('resetRequestEmail', email);
            localStorage.setItem('resetRequestRole', userType);
        } else {
            messageEl.textContent = data.message || 'Failed to send reset email';
            messageEl.style.color = 'red';
        }
    } catch (err) {
        console.error('❌ Reset request error:', err);
        messageEl.textContent = 'Error requesting password reset';
        messageEl.style.color = 'red';
    }
});

// Handle new password submission
newPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.style.color = 'red';
        return;
    }

    try {
        const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await res.json();

        if (res.ok) {
            messageEl.textContent = 'Password reset successful! Redirecting to login...';
            messageEl.style.color = 'green';
            // Clear any stored reset request data
            localStorage.removeItem('resetRequestEmail');
            localStorage.removeItem('resetRequestRole');
            setTimeout(() => window.location.href = 'login.html', 2000);
        } else {
            messageEl.textContent = data.message || 'Failed to reset password';
            messageEl.style.color = 'red';
        }
    } catch (err) {
        console.error('❌ Password reset error:', err);
        messageEl.textContent = 'Error resetting password';
        messageEl.style.color = 'red';
    }
});
