const mongoose = require('mongoose');

const idempotencyKeySchema = new mongoose.Schema({
  key: { type: String, required: true, index: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  route: { type: String, required: true },
  method: { type: String, required: true },
  statusCode: { type: Number },
  responseBody: { type: Object },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, index: true },
});

idempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', idempotencyKeySchema);


