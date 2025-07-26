// backend/routes/sellerRoutes.js

const express = require('express');
const router = express.Router();

const {
  registerSeller,
  loginSeller,
  resetSellerPassword
} = require('../controllers/sellerController');

router.post('/register', registerSeller);
router.post('/login', loginSeller);
router.post('/reset-password', resetSellerPassword);

module.exports = router;
