// backend/controllers/guestEscrowController.js

const Escrow = require('../models/Escrow');

// Guest creates an escrow transaction
const createGuestEscrow = async (req, res) => {
  try {
    const {
      guestBuyer,
      guestSeller,
      amount,
      description
    } = req.body;

    const newEscrow = new Escrow({
      guestBuyer,
      guestSeller,
      amount,
      description
    });

    await newEscrow.save();

    res.status(201).json({
      message: 'Guest escrow created successfully',
      escrow: newEscrow
    });
  } catch (error) {
    console.error('❌ Error creating guest escrow:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Guest funds the escrow
const fundGuestEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    escrow.funded = true;
    escrow.fundedAt = new Date();
    await escrow.save();

    res.status(200).json({ message: 'Escrow funded', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Guest releases funds
const releaseGuestEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (!escrow.funded) {
      return res.status(400).json({ message: 'Escrow has not been funded yet' });
    }

    escrow.status = 'released';
    escrow.releasedAt = new Date();
    await escrow.save();

    res.status(200).json({ message: 'Funds released to guest seller', escrow });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createGuestEscrow,
  fundGuestEscrow,
  releaseGuestEscrow
};
