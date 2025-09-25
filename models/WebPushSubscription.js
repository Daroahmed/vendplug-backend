const mongoose = require('mongoose');

const webPushSubscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, refPath: 'userType', required: true },
  userType: { type: String, enum: ['Buyer','Agent','Vendor','Staff','Admin'], required: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WebPushSubscription', webPushSubscriptionSchema);


