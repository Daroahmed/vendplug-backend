const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'vendplugSecret', {
    // Short-lived access token; session longevity is handled via HttpOnly refresh cookie
    expiresIn: '20m',
  });
};

module.exports = generateToken;
