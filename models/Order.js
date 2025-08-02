const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  price: Number,
  qty: Number
}, { _id: false });

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Buyer', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  items: [orderItemSchema],
  pickupLocation: String,
  totalAmount: { type: Number, required: true },
  deliveryOption: {
    type: String,
    enum: ['pickup', 'delivery'],
    default: 'delivery'
  },
  
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    default: null, // If null, it's open for all agents
  },
  
  note: String,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  }
}, { timestamps: true });

// ✅ Prevent OverwriteModelError
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
