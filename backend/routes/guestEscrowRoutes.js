// backend/routes/guestEscrowRoutes.js

const express = require('express');
const router = express.Router();
const {
  createGuestEscrow,
  fundGuestEscrow,
  releaseGuestEscrow
} = require('../controllers/guestEscrowController');

router.post('/', createGuestEscrow);
router.put('/:id/fund', fundGuestEscrow);
router.put('/:id/release', releaseGuestEscrow);

module.exports = router;
