// backend/models/notificationModel.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'recipientType', // Dynamically references Buyer, Agent, or Vendor
    },
    recipientType: {
      type: String,
      required: true,
      enum: ['buyer', 'agent', 'vendor'], // ✅ Vendor now supported
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
