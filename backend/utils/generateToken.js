const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'vendplugSecret', {
    // Reasonable token expiration - 24 hours for all users
    expiresIn: '24h',
  });
};

module.exports = generateToken;
