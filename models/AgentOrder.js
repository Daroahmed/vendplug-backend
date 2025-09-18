const mongoose = require("mongoose");

// Sub-schema for individual items in the order
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "AgentProduct", required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

// Main schema for agent orders
const agentOrderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer", required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected", "preparing", "out_for_delivery", "delivered", "fulfilled", "completed", "resolved"], 
    default: "pending" 
  },
  escrow: { type: Boolean, default: false },
  deliveryLocation: { type: String, required: true },
  statusHistory: [
    {
      status: String,
      updatedBy: String, // "buyer" or "agent"
      timestamp: { type: Date, default: Date.now },
      reason: String // For rejection reasons
    }
  ],
  rejectionReason: String, // Store rejection reason
  rejectedAt: Date // When order was rejected
  
}, { timestamps: true });

module.exports = mongoose.model("AgentOrder", agentOrderSchema);
