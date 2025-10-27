// js/config.js
// Always prefer same-origin in production so cookies/paths match Nginx
window.BACKEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : window.location.origin;

// Frontend URL for email verification links
window.FRONTEND_URL = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : window.location.origin;

// Socket.IO configuration - always use same-origin
window.SOCKET_URL = window.location.origin;

// Paystack configuration
window.PAYSTACK_PUBLIC_KEY = window.location.hostname === "localhost"
  ? "pk_test_your_test_public_key_here"
  : "pk_live_your_live_public_key_here";