// auth-utils.js - Smart Authentication Token Management
console.log("✅ auth-utils.js loaded");

/**
 * Get the appropriate authentication token based on current user context
 * @returns {string|null} The authentication token or null if not found
 */
function getAuthToken() {
  // Prefer elevated roles first to avoid using a buyer/agent token on staff/admin pages
  const adminToken = localStorage.getItem("vendplug-admin-token");
  const staffToken = localStorage.getItem("vendplug-staff-token");
  const buyerToken = localStorage.getItem("vendplug-buyer-token");
  const agentToken = localStorage.getItem("vendplug-agent-token");
  const vendorToken = localStorage.getItem("vendplug-vendor-token");
  
  // Return the first available token in priority order
  const token = adminToken || staffToken || buyerToken || agentToken || vendorToken;
  
  if (token) {
    return token;
  }
  
  // Fallback to generic token (for backward compatibility)
  const genericToken = localStorage.getItem("vendplug-token");
  if (genericToken) {
    console.log("⚠️ Using fallback generic token");
    return genericToken;
  }
  
  console.warn("❌ No authentication token found");
  return null;
}

/**
 * Get the current user type based on available tokens
 * @returns {string|null} The user type or null if not found
 */
function getCurrentUserType() {
  // Check higher privilege tokens first (admin, staff)
  if (localStorage.getItem("vendplug-admin-token")) {
    console.log("🔍 Detected admin token");
    return "admin";
  }
  if (localStorage.getItem("vendplug-staff-token")) {
    console.log("🔍 Detected staff token");
    return "staff";
  }
  // Then check regular user tokens
  if (localStorage.getItem("vendplug-buyer-token")) {
    console.log("🔍 Detected buyer token");
    return "buyer";
  }
  if (localStorage.getItem("vendplug-agent-token")) {
    console.log("🔍 Detected agent token");
    return "agent";
  }
  if (localStorage.getItem("vendplug-vendor-token")) {
    console.log("🔍 Detected vendor token");
    return "vendor";
  }
  console.log("🔍 No tokens detected");
  return null;
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
function isAuthenticated() {
  return getAuthToken() !== null;
}

/**
 * Redirect to appropriate login page based on user type
 */
function redirectToLogin() {
  const userType = getCurrentUserType();
  const loginPages = {
    buyer: "buyer-auth.html",
    agent: "agent-auth.html", 
    vendor: "vendor-auth.html",
    staff: "staff-login.html",
    admin: "admin-login.html"
  };
  
  const loginPage = loginPages[userType] || "buyer-auth.html";
  window.location.href = loginPage;
}

/**
 * Get user data from localStorage
 * @returns {Object|null} User data or null if not found
 */
function getCurrentUser() {
  const userType = getCurrentUserType();
  if (!userType) return null;
  
  // Handle different storage patterns for different user types
  let userData = null;
  if (userType === 'staff') {
    userData = localStorage.getItem('staff-info');
  } else if (userType === 'admin') {
    userData = localStorage.getItem('vendplugAdmin');
  } else {
    userData = localStorage.getItem(`vendplug${userType.charAt(0).toUpperCase() + userType.slice(1)}`);
  }
  
  return userData ? JSON.parse(userData) : null;
}

/**
 * Clear all authentication data
 */
function clearAuth() {
  localStorage.removeItem("vendplug-buyer-token");
  localStorage.removeItem("vendplug-agent-token");
  localStorage.removeItem("vendplug-vendor-token");
  localStorage.removeItem("vendplug-staff-token");
  localStorage.removeItem("vendplug-admin-token");
  localStorage.removeItem("vendplug-token"); // fallback
  localStorage.removeItem("vendplugBuyer");
  localStorage.removeItem("vendplugAgent");
  localStorage.removeItem("vendplugVendor");
  localStorage.removeItem("vendplugStaff");
  localStorage.removeItem("vendplugAdmin");
  localStorage.removeItem("staff-info"); // staff data
  localStorage.removeItem("role");
}

/**
 * Clear tokens for other user types to prevent conflicts
 * @param {string} currentUserType - The current user type to keep
 */
function clearOtherUserTokens(currentUserType) {
  const tokensToRemove = {
    buyer: ["vendplug-agent-token", "vendplug-vendor-token", "vendplug-staff-token", "vendplug-admin-token"],
    agent: ["vendplug-buyer-token", "vendplug-vendor-token", "vendplug-staff-token", "vendplug-admin-token"],
    vendor: ["vendplug-buyer-token", "vendplug-agent-token", "vendplug-staff-token", "vendplug-admin-token"],
    staff: ["vendplug-buyer-token", "vendplug-agent-token", "vendplug-vendor-token", "vendplug-admin-token"],
    admin: ["vendplug-buyer-token", "vendplug-agent-token", "vendplug-vendor-token", "vendplug-staff-token"]
  };
  
  const userDataToRemove = {
    buyer: ["vendplugAgent", "vendplugVendor", "vendplugStaff", "vendplugAdmin", "staff-info"],
    agent: ["vendplugBuyer", "vendplugVendor", "vendplugStaff", "vendplugAdmin", "staff-info"],
    vendor: ["vendplugBuyer", "vendplugAgent", "vendplugStaff", "vendplugAdmin", "staff-info"],
    staff: ["vendplugBuyer", "vendplugAgent", "vendplugVendor", "vendplugAdmin"],
    admin: ["vendplugBuyer", "vendplugAgent", "vendplugVendor", "staff-info"]
  };
  
  console.log(`🧹 Clearing tokens for other user types, keeping: ${currentUserType}`);
  console.log(`🔍 Tokens to remove:`, tokensToRemove[currentUserType]);
  console.log(`🔍 User data to remove:`, userDataToRemove[currentUserType]);
  
  // Debug: Show all tokens before cleanup
  console.log(`🔍 All localStorage keys before cleanup:`, Object.keys(localStorage).filter(key => key.includes('vendplug')));
  
  if (tokensToRemove[currentUserType]) {
    tokensToRemove[currentUserType].forEach(token => {
      const existed = localStorage.getItem(token);
      if (existed) {
        console.log(`🗑️ Removing token: ${token}`);
        localStorage.removeItem(token);
      }
    });
  }
  
  if (userDataToRemove[currentUserType]) {
    userDataToRemove[currentUserType].forEach(data => {
      const existed = localStorage.getItem(data);
      if (existed) {
        console.log(`🗑️ Removing user data: ${data}`);
        localStorage.removeItem(data);
      }
    });
  }
  
  console.log(`✅ Token cleanup completed for: ${currentUserType}`);
}

/**
 * Automatically clean up conflicting tokens after successful login
 * Only runs when there's a clear, valid user session
 */
function autoCleanupTokens() {
  const currentUserType = getCurrentUserType();
  const currentUser = getCurrentUser();
  
  // Only cleanup if we have both a user type AND valid user data
  if (currentUserType && currentUser) {
    console.log(`🧹 Auto-cleaning tokens for authenticated user: ${currentUserType}`);
    clearOtherUserTokens(currentUserType);
  } else {
    // Don't auto-cleanup on dashboard pages or when no valid session exists
    console.log('🔍 No valid user session found, skipping token cleanup');
  }
}

/**
 * Clear all authentication tokens and user data
 */
function clearAllTokens() {
  console.log('🧹 Clearing all authentication tokens and user data');
  clearAuth();
  localStorage.removeItem('staff-info');
  console.log('✅ All tokens and user data cleared');
}

/**
 * Call this after successful login to clean up conflicting tokens
 * @param {string} userType - The user type that just logged in
 */
function cleanupAfterLogin(userType) {
  console.log(`🧹 Cleaning up tokens after ${userType} login`);
  clearOtherUserTokens(userType);
  console.log(`✅ Token cleanup completed for ${userType}`);
}

// Export functions for global use
window.getAuthToken = getAuthToken;
window.getCurrentUserType = getCurrentUserType;
window.isAuthenticated = isAuthenticated;
window.redirectToLogin = redirectToLogin;
window.getCurrentUser = getCurrentUser;
window.clearAuth = clearAuth;
window.clearOtherUserTokens = clearOtherUserTokens;
window.autoCleanupTokens = autoCleanupTokens;
window.clearAllTokens = clearAllTokens;
window.cleanupAfterLogin = cleanupAfterLogin;

// Lightweight global loading overlay
;(function(){
  try {
    if (!document.getElementById('global-loading-overlay')) {
      const style = document.createElement('style');
      style.textContent = `
        .loading-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:9999}
        .loading-spinner{width:56px;height:56px;border:4px solid rgba(255,255,255,0.25);border-top-color:var(--primary, #00cc99);border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `;
      document.head.appendChild(style);
      const overlay = document.createElement('div');
      overlay.id = 'global-loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      const mount = ()=>{ try{ if (!document.getElementById('global-loading-overlay')) document.body.appendChild(overlay);}catch(_){} };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
      } else {
        mount();
      }
    }
  } catch(_){}
  window.showLoading = function(){
    let el = document.getElementById('global-loading-overlay');
    if (!el) {
      try{
        el = document.createElement('div');
        el.id = 'global-loading-overlay';
        el.className = 'loading-overlay';
        el.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(el);
      }catch(_){ return; }
    }
    el.style.display = 'flex';
  };
  window.hideLoading = function(){ const el = document.getElementById('global-loading-overlay'); if (el) el.style.display = 'none'; };
})();

/**
 * Full logout: clear tokens, user data, carts and unsubscribe from push
 * @param {('buyer'|'vendor'|'agent'|'staff'|'admin')} [currentUserType]
 */
async function logout(currentUserType){
  try { if (window.showLoading) window.showLoading(); } catch(_) {}
  // Fire-and-forget push unsubscribe without blocking redirect
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(async (regs)=>{
        try {
          await Promise.all((regs||[]).map(async (r)=>{
            try { const sub = await r.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch(_) {}
          }));
        } catch(_) {}
      }).catch(()=>{});
    }
  } catch(_) {}

  // Clear auth and user-specific storage
  try { if (typeof clearAuth === 'function') clearAuth(); } catch(_) {}
  // Remove carts and transient data
  try { localStorage.removeItem('vendorCart'); } catch(_) {}
  try { localStorage.removeItem('agentCart'); } catch(_) {}
  try { localStorage.removeItem('cart'); } catch(_) {}
  try { localStorage.removeItem('vendplug-category'); } catch(_) {}
  try { localStorage.removeItem('vendplug-buyer-state'); } catch(_) {}
  try { localStorage.removeItem('role'); } catch(_) {}

  try { if (window.hideLoading) window.hideLoading(); } catch(_) {}
  // Redirect to auth selection (entry point)
  window.location.href = 'auth-selection.html';
}

window.logout = logout;

// Lightweight vendor-specific wrapper if inline handler is cached
window.vendorLogout = function(){ try{ logout('vendor'); }catch(_){ window.location.href = 'auth-selection.html'; } };

// Minimal Web Push client helper (permission + subscribe)
window.enablePushIfPossible = async function() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    // Get server public key
    const keyRes = await fetch('/api/notifications/push/vapid-public-key');
    const { publicKey } = await keyRes.json();
    if (!publicKey) return; // push not configured

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const token = getAuthToken();
    await fetch('/api/notifications/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
      body: JSON.stringify(sub)
    });
  } catch (e) { console.warn('Push subscribe skipped:', e.message); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Tiny toast helper for user feedback
;(function(){
  try {
    if (!document.getElementById('vp-toast-container')) {
      const style = document.createElement('style');
      style.textContent = `
        .vp-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:99999;display:flex;gap:8px;align-items:center;background:#1e1e1e;color:#fff;border:1px solid rgba(255,255,255,.1);padding:10px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .25s ease}
        .vp-toast.show{opacity:1}
        .vp-overlay-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;z-index:100000}
        .vp-overlay-card{width:min(92vw,380px);background:#1e1e1e;border:1px solid rgba(255,255,255,.08);border-radius:14px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.45);padding:22px;text-align:center}
        .vp-overlay-icon{font-size:42px;margin-bottom:10px}
        .vp-ok{color:#00cc99}
        .vp-err{color:#ff5c5c}
        .vp-info{color:#66b2ff}
        .vp-overlay-title{font-weight:700;margin:8px 0 4px}
        .vp-overlay-msg{opacity:.9}
        .vp-overlay-actions{margin-top:16px}
        .vp-overlay-btn{background:#00cc99;color:#000;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:700}
        .vp-overlay-btn.secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.15);margin-left:8px}
      `;
      document.head.appendChild(style);
      const c = document.createElement('div');
      c.id = 'vp-toast-container';
      document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(c));
    }
  } catch(_){}
  window.showToast = function(message, timeout=3000){
    const c = document.getElementById('vp-toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'vp-toast';
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 250); }, timeout);
  };
  // Pretty overlay (success/error/info)
  window.showOverlay = function(opts){
    try{
      const options = typeof opts === 'string' ? { message: opts } : (opts||{});
      const type = options.type || 'success';
      const title = options.title || (type==='success'?'Success': type==='error'?'Error':'Notice');
      const message = options.message || '';
      const autoClose = options.autoClose ?? (type==='success' ? 1600 : null);
      const onClose = typeof options.onClose === 'function' ? options.onClose : null;
      const icon = type==='success' ? '✔' : (type==='error' ? '✖' : 'ℹ');
      const colorClass = type==='success' ? 'vp-ok' : (type==='error' ? 'vp-err' : 'vp-info');

      const backdrop = document.createElement('div');
      backdrop.className = 'vp-overlay-backdrop';
      backdrop.innerHTML = `
        <div class="vp-overlay-card">
          <div class="vp-overlay-icon ${colorClass}">${icon}</div>
          <div class="vp-overlay-title">${title}</div>
          <div class="vp-overlay-msg">${message}</div>
          <div class="vp-overlay-actions">
            <button class="vp-overlay-btn">OK</button>
          </div>
        </div>`;
      const close = ()=>{ try{ backdrop.remove(); if(onClose) onClose(); }catch(_){}}
      backdrop.querySelector('.vp-overlay-btn').addEventListener('click', close);
      document.body.appendChild(backdrop);
      if (autoClose) setTimeout(close, autoClose);
      return close;
    }catch(_){ try{ alert(opts?.message || opts || ''); }catch(__){} }
  };
})();

// Ensure push CTA loads on most pages
;(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    try{ const s=document.createElement('script'); s.src='/js/push-cta.js'; document.body.appendChild(s);}catch(_){}
    try{ const s2=document.createElement('script'); s2.src='/js/back-button.js'; document.body.appendChild(s2);}catch(_){}
    // Auto-cleanup only runs after successful login, not on every page load
    try{ autoCleanupTokens(); }catch(_){}
  });
})();

// ===== Silent refresh helper =====
;(function(){
  async function tryRefresh(){
    try {
      // Skip refresh for admin and staff pages to prevent token conflicts
      const currentPath = window.location.pathname;
      if (currentPath.includes('admin') || currentPath.includes('staff')) {
        console.log(`🔄 Skipping token refresh for admin/staff page: ${currentPath}`);
        return;
      }
      
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(()=>({}));
      if (data?.token && data?.role){
        // Store short-lived access token under role-specific key
        const map = { 
          buyer:'vendplug-buyer-token', 
          agent:'vendplug-agent-token', 
          vendor:'vendplug-vendor-token',
          staff:'vendplug-staff-token',
          admin:'vendplug-admin-token'
        };
        const k = map[data.role] || 'vendplug-token';
        localStorage.setItem(k, data.token);
      }
    } catch(_) {}
  }

  // Run on load, then periodically to keep session alive
  if (document.visibilityState !== 'hidden') tryRefresh();
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') tryRefresh(); });
  // Refresh every 10 minutes
  setInterval(tryRefresh, 10*60*1000);
})();