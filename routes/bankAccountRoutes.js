const express = require('express');
const router = express.Router();
const getJWTSecret = require('../utils/jwtSecret');
const {
  addBankAccount,
  getBankAccounts,
  setDefaultBankAccount,
  deleteBankAccount
} = require('../controllers/bankAccountController');

// Authentication middleware (inline for now)
const authenticateUser = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const jwtSecret = getJWTSecret();
    
    const decoded = jwt.verify(token, jwtSecret);
    req.user = {
      id: decoded.id,
      role: decoded.role
    };
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Bank account routes
router.post('/add', authenticateUser, addBankAccount);
router.get('/list', authenticateUser, getBankAccounts);
router.put('/:accountId/set-default', authenticateUser, setDefaultBankAccount);
router.delete('/:accountId', authenticateUser, deleteBankAccount);

module.exports = router;
