const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  role: { type: String, enum: ['buyer', 'agent', 'vendor', 'admin', 'staff'], required: true, index: true },
  token: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'unknown' },
  active: { type: Boolean, default: true },
  lastUsedAt: { type: Date, default: Date.now }
}, { timestamps: true });

deviceTokenSchema.index({ userId: 1, role: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);

