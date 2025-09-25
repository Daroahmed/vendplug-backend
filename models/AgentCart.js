// backend/models/agentCartModel.js
const mongoose = require("mongoose");

const agentCartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AgentProduct", // Ensure this matches your AgentProduct model name
    required: true,
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent", // Ensure this matches your Agent model name
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
});

const agentCartSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
    },
    items: [agentCartItemSchema],
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Middleware to auto-calc totalAmount whenever items are updated
agentCartSchema.pre("save", function (next) {
  this.totalAmount = this.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
  next();
});

module.exports = mongoose.model("AgentCart", agentCartSchema);
