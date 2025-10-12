// backend/routes/adminAuth.js
const express = require('express');
const router = express.Router();
const {
  loginAdmin,
  getAllUsers,
  getAllEscrows
} = require('../controllers/adminController');

// Login
router.post('/login', loginAdmin);

// Get all users (buyers and sellers)
router.get('/users', getAllUsers);

// Get all escrows
router.get('/escrows', getAllEscrows);

module.exports = router;
