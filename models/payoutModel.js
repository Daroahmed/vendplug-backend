// models/payoutModel.js
const mongoose = require("mongoose");

const payoutSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor", // or "Vendor" depending on your naming
      required: true, unique: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorOrder",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },


    status: {
      type: String,
      enum: [
        "pending",           // created but not yet confirmed
        "pending_receipt",   // vendor accepted, waiting for buyer confirmation
        "ready_for_payout",  // buyer confirmed, vendor can request payout
        "requested",         // vendor has requested payout
        "paid",              // payout completed
        "failed"             // payout failed
      ],
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

module.exports = mongoose.model("Payout", payoutSchema, "payouts");
