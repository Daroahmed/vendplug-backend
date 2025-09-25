// models/agentPayoutModel.js
const mongoose = require("mongoose");

const agentPayoutSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent", // Changed from Vendor to Agent
      required: true, unique: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentOrder", // Changed from VendorOrder to AgentOrder
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
        "pending_receipt",   // agent accepted, waiting for buyer confirmation
        "ready_for_payout",  // buyer confirmed, agent can request payout
        "requested",         // agent has requested payout
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

module.exports = mongoose.model("AgentPayout", agentPayoutSchema, "agentPayouts");
