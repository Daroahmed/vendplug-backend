const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  eventType: { type: String, required: true }, // WALLET_DEBIT, WALLET_CREDIT, PAYOUT_REQUESTED, PAYOUT_FAILED, PAYOUT_COMPLETED
  userId: { type: mongoose.Schema.Types.ObjectId },
  userType: { type: String },
  amount: { type: Number },
  refId: { type: String },
  metadata: { type: Object },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);


