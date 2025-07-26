// backend/routes/escrowRoutes.js
const express = require('express');
const router = express.Router();

const {
  createEscrow,
  approveEscrow,
  cancelEscrow,
  completeEscrow,
  fundEscrow,
  releaseEscrow,
  getEscrowsByBuyer,
  getEscrowsBySeller
} = require('../controllers/escrowController');

router.post('/', createEscrow);
router.put('/:id/approve', approveEscrow);
router.put('/:id/cancel', cancelEscrow);
router.put('/:id/complete', completeEscrow);
router.put('/:id/fund', fundEscrow);
router.put('/:id/release', releaseEscrow);
router.get('/buyer/:buyerId', getEscrowsByBuyer);
router.get('/seller/:sellerId', getEscrowsBySeller);

module.exports = router;
