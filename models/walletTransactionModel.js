// models/walletTransactionModel.js
const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["debit", "credit"], required: true },
  amount: { type: Number, required: true },
  reference: { type: String }, // orderId, payoutId, etc
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
