const mongoose = require("mongoose");

const agentWalletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "role",
      unique: true, // Ensure one wallet per user
    },
    role: {
      type: String,
      required: true,
      enum: ['buyer', 'agent', 'vendor'],
    },
    virtualAccount: {
      type: String,
      required: true,
      unique: true,
    },
    currency: {
      type: String,
      default: 'NGN',
    },
    balance: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AgentWallet", agentWalletSchema);
