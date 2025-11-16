/**
 * Rate Limiting Middleware
 * Prevents brute force attacks, API abuse, and DOS attacks
 */

const rateLimit = require('express-rate-limit');

// Helpers to read boolean envs robustly
function envBool(name, defaultValueTrue = true) {
  const v = process.env[name];
  if (v === undefined || v === null) return !!defaultValueTrue;
  const s = String(v).trim().toLowerCase();
  if (['false', '0', 'no', 'off', 'disabled'].includes(s)) return false;
  if (['true', '1', 'yes', 'on', 'enabled'].includes(s)) return true;
  return !!defaultValueTrue;
}

// Global toggle to enable/disable all rate limiters via environment
// Examples to disable: RATE_LIMIT_ENABLED=false, or 0, or "off"
const rateLimitEnabled = envBool('RATE_LIMIT_ENABLED', true);
const passthrough = (req, res, next) => next();
const useLimiter = (limiter, featureFlagName) => {
  if (!rateLimitEnabled) return passthrough;
  if (featureFlagName && !envBool(featureFlagName, true)) return passthrough;
  return limiter;
};

// Rate limiter for authentication endpoints (login, password reset)
// CTO Recommendation: Allow reasonable attempts (10) for legitimate users while preventing brute force
// Skip successful logins so users aren't penalized for correct credentials
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow 10 authentication attempts per 15 minutes (reasonable for legitimate use)
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests - don't penalize correct passwords
  // This is best practice: only count failed attempts to prevent brute force
  skipSuccessfulRequests: true,
  // Count failed requests to detect brute force attacks
  skipFailedRequests: false,
  // Key by IP + credential identifier to avoid one shared IP blocking everyone
  keyGenerator: (req /*, res */) => {
    const ip =
      req.ip ||
      req.headers['x-forwarded-for'] ||
      (req.connection && req.connection.remoteAddress) ||
      'unknown';
    let identifier = '';
    try {
      const body = req.body || {};
      identifier = String(
        (body.email || body.username || body.user || '').toString().trim().toLowerCase()
      );
    } catch (_) {
      // no-op
    }
    return `${ip}:${identifier}`;
  },
  // Store rate limit info in memory (can be upgraded to Redis for distributed systems)
  store: undefined,
});

// Strict rate limiter for PIN reset
const pinResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 PIN reset attempts per hour
  message: {
    success: false,
    message: 'Too many PIN reset attempts. Please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for payout requests (financial operations)
const payoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 payout requests per hour per IP
  message: {
    success: false,
    message: 'Too many payout requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests - only count failed ones
  skipSuccessfulRequests: true,
});

// Rate limiter for payment/wallet funding
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 payment attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many payment attempts. Please wait a moment before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// Lenient rate limiter for browsing/search endpoints (public read-only)
// Increased limit to handle multiple category requests during page load
// Use default IP-based limiting (library handles IPv6 automatically)
// Note: Removed custom keyGenerator to avoid IPv6 validation errors - IP-based limiting is sufficient
// Since limit is already very lenient (100/min), path-specific limiting isn't needed
const browsingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Allow 100 requests per minute for browsing (handles multiple category loads)
  message: {
    success: false,
    message: 'Too many browsing requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Default keyGenerator uses IP (library handles IPv6 correctly)
  // No custom keyGenerator needed - 100 requests/min per IP is sufficient
});

// General API rate limiter (for authenticated and write endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for PIN verification (during payout)
const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 PIN verification attempts per 15 minutes
  message: {
    success: false,
    message: 'Too many PIN verification attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Don't skip failed requests - count them to prevent brute force
  skipFailedRequests: false,
});

// Rate limiter for registration endpoints
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 registration attempts per hour per IP
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient rate limiter for authenticated dashboard endpoints (orders, stats, history, etc.)
// These endpoints are polled frequently by dashboard pages and need higher limits
const dashboardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Allow 60 requests per minute for dashboard polling (orders, stats, payouts)
  message: {
    success: false,
    message: 'Too many dashboard requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests to be more lenient on normal usage
  skipSuccessfulRequests: true,
});

// Very lenient limiter for token refresh (needed for session management)
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // Allow 120 refresh requests per 5 minutes
  message: {
    success: false,
    message: 'Too many refresh requests. Please wait a moment.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

module.exports = {
  // Per-feature flags allow targeted disable if needed (default inherits global)
  authLimiter: useLimiter(authLimiter, 'AUTH_RATE_LIMIT_ENABLED'),
  pinResetLimiter: useLimiter(pinResetLimiter, 'PIN_RESET_RATE_LIMIT_ENABLED'),
  payoutLimiter: useLimiter(payoutLimiter, 'PAYOUT_RATE_LIMIT_ENABLED'),
  paymentLimiter: useLimiter(paymentLimiter, 'PAYMENT_RATE_LIMIT_ENABLED'),
  apiLimiter: useLimiter(apiLimiter, 'API_RATE_LIMIT_ENABLED'),
  pinVerifyLimiter: useLimiter(pinVerifyLimiter, 'PIN_VERIFY_RATE_LIMIT_ENABLED'),
  registrationLimiter: useLimiter(registrationLimiter, 'REGISTRATION_RATE_LIMIT_ENABLED'),
  browsingLimiter: useLimiter(browsingLimiter, 'BROWSING_RATE_LIMIT_ENABLED'),
  dashboardLimiter: useLimiter(dashboardLimiter, 'DASHBOARD_RATE_LIMIT_ENABLED'),
  refreshLimiter: useLimiter(refreshLimiter, 'REFRESH_RATE_LIMIT_ENABLED'),
};

