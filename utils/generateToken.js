const jwt = require('jsonwebtoken');
const getJWTSecret = require('./jwtSecret');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, getJWTSecret(), {
    // Reasonable token expiration - 24 hours for all users
    expiresIn: '24h',
  });
};

module.exports = generateToken;
