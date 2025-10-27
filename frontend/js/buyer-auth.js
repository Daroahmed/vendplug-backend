console.log("✅ buyer-auth.js loaded");

const BACKEND = window.BACKEND_URL || "";

// Clean up any existing tokens when login page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧹 Buyer login page loaded - cleaning up existing tokens');
  if (typeof clearAllTokens === 'function') {
    clearAllTokens();
  }
  
  // Initialize form toggle functionality
  initializeFormToggle();
});

// Form toggle functionality
function initializeFormToggle() {
  const loginForm = document.getElementById('buyerLoginForm');
  const registerForm = document.getElementById('buyerRegisterForm');
  const showLoginBtn = document.getElementById('showLoginBtn');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const authSubtitle = document.getElementById('authSubtitle');
  const toggleText = document.getElementById('toggleText');

  showRegisterBtn.addEventListener('click', () => {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
    showRegisterBtn.style.display = 'none';
    showLoginBtn.style.display = 'block';
    authSubtitle.textContent = 'Create your account to get started';
    toggleText.textContent = 'Already have an account?';
  });

  showLoginBtn.addEventListener('click', () => {
    registerForm.classList.remove('active');
    loginForm.classList.add('active');
    showLoginBtn.style.display = 'none';
    showRegisterBtn.style.display = 'block';
    authSubtitle.textContent = 'Welcome back! Please sign in to your account';
    toggleText.textContent = 'Don\'t have an account yet?';
  });
}

// Password visibility toggle function with modern icons
function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  const icon = button.querySelector('i');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
    button.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
    button.setAttribute('aria-label', 'Show password');
  }
}

// 🔐 LOGIN
document.getElementById("buyerLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const messageEl = document.getElementById("loginMessage");
  try { showLoading && showLoading(); } catch(_) {}

  try {
    const res = await fetch(`${BACKEND}/api/buyers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403 && data && data.code === 'EMAIL_NOT_VERIFIED') {
        try { hideLoading && hideLoading(); } catch(_) {}
        window.location.href = `verify-email.html?prefill=${encodeURIComponent(data.email)}&userType=buyer`;
        return;
      }
      if (messageEl) {
        // Handle specific error cases with user-friendly messages
        let errorMessage = data.message || "Login failed";
        
        if (res.status === 401) {
          errorMessage = "Invalid email or password. Please check your credentials.";
        } else if (res.status === 404) {
          errorMessage = "Account not found. Please check your email or register for a new account.";
        } else if (res.status === 403) {
          errorMessage = "Account access denied. Please contact support.";
        } else if (res.status >= 500) {
          errorMessage = "Server error. Please try again later.";
        }
        
        messageEl.textContent = errorMessage;
        messageEl.className = "message error";
        messageEl.style.display = "block";
      }
      return;
    }

    localStorage.setItem("vendplug-buyer-token", data.token);
    // Store only the buyer object, not the entire response
    const buyerData = {
      _id: data._id,
      fullName: data.fullName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      virtualAccount: data.virtualAccount,
      role: data.role || "buyer"
    };
    localStorage.setItem("vendplugBuyer", JSON.stringify(buyerData));
    
    // Clean up conflicting tokens after successful buyer login
    if (typeof cleanupAfterLogin === 'function') {
      cleanupAfterLogin('buyer');
    }
    
    if (messageEl) {
      messageEl.textContent = "Login successful!";
      messageEl.className = "message success";
      messageEl.style.display = "block";
    }
    setTimeout(() => { window.location.href = "public-buyer-home.html"; }, 600);

  } catch (err) {
    console.error("❌ Buyer login error:", err);
    if (messageEl) {
      // Handle network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        messageEl.textContent = "Network error. Please check your connection and try again.";
      } else if (err.name === 'SyntaxError') {
        messageEl.textContent = "Server response error. Please try again.";
      } else {
        messageEl.textContent = "Login failed. Try again.";
      }
      messageEl.className = "message error";
      messageEl.style.display = "block";
    }
  } finally { try { hideLoading && hideLoading(); } catch(_) {} }
});

// 📝 REGISTER
document.getElementById("buyerRegisterForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("registerFullName").value;
  const email = document.getElementById("registerEmail").value;
  const phoneNumber = document.getElementById("registerPhone").value;
  const password = document.getElementById("registerPassword").value;
  const messageEl = document.getElementById("registerMessage");

  try {
    try { showLoading && showLoading(); } catch(_) {}
    const res = await fetch(`${BACKEND}/api/buyers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, phoneNumber, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Buyer registration failed");
    }

    // Store email for verification (same as vendor/agent flow)
    localStorage.setItem('pendingVerificationEmail', email);
    localStorage.setItem('pendingVerificationRole', 'buyer');

    // Send verification email
    try {
      const verifyRes = await fetch(`${BACKEND}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userType: 'buyer' })
      });

      if (verifyRes.ok) {
        messageEl.textContent = "Registration successful! Please check your email to verify your account.";
        messageEl.className = "message success";
        messageEl.style.display = "block";
        setTimeout(() => (window.location.href = "verify-email.html"), 1000);
      } else {
        messageEl.textContent = "Registration successful but couldn't send verification email. Please try again.";
        messageEl.className = "message error";
        messageEl.style.display = "block";
      }
    } catch (verifyErr) {
      console.error("❌ Verification email error:", verifyErr);
      messageEl.textContent = "Registration successful but couldn't send verification email. Please try again.";
      messageEl.className = "message error";
      messageEl.style.display = "block";
    }

  } catch (error) {
    console.error("❌ Registration error:", error);
    
    // Handle specific error cases with user-friendly messages
    let errorMessage = error.message || "Registration failed.";
    
    if (error.message && error.message.includes("already exists")) {
      errorMessage = "An account with this email already exists. Please try logging in instead.";
    } else if (error.message && error.message.includes("duplicate")) {
      errorMessage = "Account already exists. Please try logging in instead.";
    } else if (error.message && error.message.includes("validation")) {
      errorMessage = "Please check your information and try again.";
    }
    
    messageEl.textContent = errorMessage;
    messageEl.className = "message error";
    messageEl.style.display = "block";
  } finally { try { hideLoading && hideLoading(); } catch(_) {} }
});
