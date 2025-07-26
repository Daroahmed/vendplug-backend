// backend/controllers/escrowController.js

const Escrow = require('../models/Escrow');

// ✅ Create Escrow
const createEscrow = async (req, res) => {
  try {
    const { buyerId, sellerId, amount, description } = req.body;

    const newEscrow = new Escrow({
      buyer: buyerId,
      seller: sellerId,
      amount,
      description
    });

    await newEscrow.save();

    res.status(201).json({
      message: 'Escrow created successfully',
      escrow: newEscrow
    });
  } catch (error) {
    console.error('❌ Error creating escrow:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Approve Escrow
const approveEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    escrow.status = 'approved';
    await escrow.save();

    res.status(200).json({ message: 'Escrow approved', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Cancel Escrow
const cancelEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    escrow.status = 'cancelled';
    await escrow.save();

    res.status(200).json({ message: 'Escrow cancelled', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Complete Escrow
const completeEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    escrow.status = 'completed';
    await escrow.save();

    res.status(200).json({ message: 'Escrow completed', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Fund Escrow
const fundEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    // Simulate payment
    escrow.funded = true;
    escrow.fundedAt = new Date();

    await escrow.save();

    res.status(200).json({ message: 'Escrow funded successfully', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Release Funds from Escrow
const releaseEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (!escrow.funded) {
      return res.status(400).json({ message: 'Escrow has not been funded yet' });
    }

    if (escrow.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed escrows can be released' });
    }

    escrow.status = 'released';
    escrow.releasedAt = new Date();

    await escrow.save();

    res.status(200).json({ message: 'Funds released to seller', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Get all escrows for a buyer
const getEscrowsByBuyer = async (req, res) => {
  try {
    const escrows = await Escrow.find({ buyer: req.params.buyerId });
    res.status(200).json({ escrows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ✅ Get all escrows for a seller
const getEscrowsBySeller = async (req, res) => {
  try {
    const escrows = await Escrow.find({ seller: req.params.sellerId });
    res.status(200).json({ escrows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// ✅ Export all

module.exports = {
  createEscrow,
  approveEscrow,
  cancelEscrow,
  completeEscrow,
  fundEscrow,
  releaseEscrow,
  getEscrowsByBuyer,
  getEscrowsBySeller
};

