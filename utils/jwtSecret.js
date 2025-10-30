/**
 * Secure JWT Secret Helper
 * Ensures JWT_SECRET is always set and never falls back to a default
 * This prevents authentication bypass vulnerabilities
 */

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    console.error('❌ FATAL SECURITY ERROR: JWT_SECRET environment variable is not set!');
    throw new Error('JWT_SECRET environment variable is required for security. Please set it in your .env file.');
  }
  
  // Only warn once per application start, not on every call
  if (!getJWTSecret._warned && (secret === 'vendplugSecret' || secret.length < 32)) {
    console.warn('⚠️ WARNING: JWT_SECRET appears to be weak. Use a strong random secret (minimum 32 characters).');
    console.warn('💡 To generate a secure secret, run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    getJWTSecret._warned = true;
  }
  
  return secret;
};

module.exports = getJWTSecret;

