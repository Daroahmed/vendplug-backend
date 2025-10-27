console.log("✅ verify-email.js loaded");

// Global variables
let BACKEND_URL = null;
let token = null;
let prefillEmail = null;
let prefillUserType = null;

// DOM elements
let statusMessage = null;
let manualForm = null;
let actionButtons = null;
let resendEmail = null;
let resendUserType = null;
let resendButton = null;
let cancelResend = null;
let resendVerificationBtn = null;
let backToLoginBtn = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 DOM loaded, starting verification process...");
  
  // Get DOM elements
  statusMessage = document.getElementById('statusMessage');
  manualForm = document.getElementById('manualForm');
  actionButtons = document.getElementById('actionButtons');
  resendEmail = document.getElementById('resendEmail');
  resendUserType = document.getElementById('resendUserType');
  resendButton = document.getElementById('resendButton');
  cancelResend = document.getElementById('cancelResend');
  resendVerificationBtn = document.getElementById('resendVerificationBtn');
  backToLoginBtn = document.getElementById('backToLoginBtn');
  
  console.log("🔍 DOM elements found:", {
    statusMessage: !!statusMessage,
    manualForm: !!manualForm,
    actionButtons: !!actionButtons,
    resendEmail: !!resendEmail,
    resendUserType: !!resendUserType,
    resendButton: !!resendButton,
    cancelResend: !!cancelResend,
    resendVerificationBtn: !!resendVerificationBtn,
    backToLoginBtn: !!backToLoginBtn
  });
  
  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  token = urlParams.get('token');
  
  // Get prefill data from URL parameters first, then localStorage
  prefillEmail = urlParams.get('prefill') || localStorage.getItem('pendingVerificationEmail');
  prefillUserType = urlParams.get('userType') || localStorage.getItem('pendingVerificationRole');
  
  console.log("🔍 Data:", { token, prefillEmail, prefillUserType });
  
  // Set up event listeners
  setupEventListeners();
  
  // Determine the flow
  console.log("🔍 Flow detection:", { 
    hasToken: !!token, 
    hasPrefillEmail: !!prefillEmail, 
    hasPrefillUserType: !!prefillUserType 
  });
  
  if (token) {
    // User clicked verification link from email
    console.log("🔍 Flow: Token verification");
    await handleTokenVerification();
  } else if (prefillEmail && prefillUserType) {
    // User was redirected from registration
    console.log("🔍 Flow: Registration success");
    showRegistrationSuccess();
  } else {
    // User accessed page directly (manual resend)
    console.log("🔍 Flow: Manual resend");
    showManualResendForm();
  }
});

// Set up event listeners
function setupEventListeners() {
  // Resend button in manual form
  if (resendButton) {
    resendButton.addEventListener('click', handleManualResend);
  }
  
  // Cancel resend button
  if (cancelResend) {
    cancelResend.addEventListener('click', () => {
      showManualResendForm();
    });
  }
  
  // Resend verification button (from action buttons)
  if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener('click', () => {
      showManualResendForm();
    });
  }
}

// Handle token verification (user clicked email link)
async function handleTokenVerification() {
  console.log("🔍 Verifying token:", token);
  showStatus("Verifying your email...");
  
  try {
    // Wait for config to load
    await waitForConfig();
    
    // Verify the token
    const response = await fetch(`${BACKEND_URL}/api/auth/verify-email?token=${token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ Verification successful, clearing loading state...");
      
      // Clear any pending verification data first
      localStorage.removeItem('pendingVerificationEmail');
      localStorage.removeItem('pendingVerificationRole');
      
      // Show success message and action buttons
      showSuccess("Email verified successfully! You can now log in to your account.");
      showActionButtons();
      
      console.log("✅ Verification flow completed");
    } else {
      if (data.code === 'TOKEN_EXPIRED') {
        showError("Verification link has expired. Please request a new one.");
        showActionButtons();
      } else if (data.code === 'TOKEN_INVALID') {
        showError("Invalid verification link. Please request a new one.");
        showActionButtons();
      } else {
        showError(data.message || "Verification failed. Please try again.");
        showActionButtons();
      }
    }
  } catch (error) {
    console.error("❌ Verification error:", error);
    showError("Network error. Please check your connection and try again.");
    showActionButtons();
  }
}

// Show registration success (user redirected from registration)
function showRegistrationSuccess() {
  console.log("✅ Showing registration success");
  showSuccess("Please check your email and click the verification link to complete your registration.");
  showActionButtons();
}

// Show manual resend form (user accessed page directly)
function showManualResendForm() {
  console.log("📧 Showing manual resend form");
  
  // Clear the loading state
  if (statusMessage) {
    statusMessage.innerHTML = '';
    statusMessage.className = "message";
  }
  
  // Show the manual form
  if (manualForm) {
    manualForm.style.display = 'block';
  }
  
  // Hide action buttons
  if (actionButtons) {
    actionButtons.style.display = 'none';
  }
  
  // Pre-fill email if available
  if (prefillEmail && resendEmail) {
    resendEmail.value = prefillEmail;
  }
  if (prefillUserType && resendUserType) {
    resendUserType.value = prefillUserType;
  }
}

// Handle manual resend
async function handleManualResend() {
  const email = resendEmail.value.trim();
  const userType = resendUserType.value;
  
  if (!email || !userType) {
    showError("Please enter both email and account type.");
    return;
  }
  
  showStatus("Sending verification email...");
  
  try {
    await waitForConfig();
    
    const response = await fetch(`${BACKEND_URL}/api/auth/send-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, userType })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showSuccess("Verification email sent! Please check your inbox and click the verification link.");
      showActionButtons();
    } else {
      showError(data.message || "Failed to send verification email. Please try again.");
    }
  } catch (error) {
    console.error("❌ Resend error:", error);
    showError("Network error. Please check your connection and try again.");
  }
}

// Show status message without spinner
function showStatus(message, className = "message") {
  if (statusMessage) {
    statusMessage.innerHTML = `<p>${message}</p>`;
    statusMessage.className = className;
  }
  manualForm.style.display = 'none';
  actionButtons.style.display = 'none';
}

// Hide loading state
function hideLoading() {
  if (statusMessage) {
    statusMessage.innerHTML = '';
  }
}

// Show success message
function showSuccess(message) {
  console.log("✅ Showing success message:", message);
  if (statusMessage) {
    // Clear any existing content completely
    statusMessage.innerHTML = '';
    statusMessage.className = '';
    
    // Add the success message
    statusMessage.innerHTML = `
      <div class="message success">
        ${message}
      </div>
    `;
    statusMessage.className = "message success";
    console.log("✅ Success message HTML set:", statusMessage.innerHTML);
  }
  if (manualForm) {
    manualForm.style.display = 'none';
  }
  if (actionButtons) {
    actionButtons.style.display = 'none';
  }
}

// Show error message
function showError(message) {
  if (statusMessage) {
    statusMessage.innerHTML = `
      <div class="message error">
        ${message}
      </div>
    `;
    statusMessage.className = "message error";
  }
  manualForm.style.display = 'none';
}

// Show action buttons
function showActionButtons() {
  console.log("✅ Showing action buttons");
  if (actionButtons) {
    actionButtons.style.display = 'block';
    console.log("✅ Action buttons displayed");
  } else {
    console.error("❌ Action buttons element not found");
  }
}

// Wait for config to load
async function waitForConfig() {
  console.log("⏳ Waiting for config to load...");
  
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max
  
  while (!window.BACKEND_URL && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (window.BACKEND_URL) {
    BACKEND_URL = window.BACKEND_URL;
    console.log("✅ Config loaded:", BACKEND_URL);
  } else {
    throw new Error("Config failed to load after 5 seconds");
  }
}

// Test function for debugging
window.testVerification = function() {
  console.log("🧪 Testing verification system...");
  console.log("Backend URL:", BACKEND_URL);
  console.log("Token:", token);
  console.log("Prefill data:", { prefillEmail, prefillUserType });
  console.log("DOM elements:", {
    statusMessage: !!statusMessage,
    manualForm: !!manualForm,
    actionButtons: !!actionButtons
  });
};