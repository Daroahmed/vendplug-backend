// models/payoutModel.js
const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent", // or "Vendor" depending on your naming
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "failed"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String, // e.g., Flutterwave/Paystack transaction ID
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payout", payoutSchema);
