const mongoose = require('mongoose');

const agentProductSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent', // ✅ Matches agent model name
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  
  category: { type: [String], required: true },

  description: { type: String },
  stock: { type: Number },
  reserved: { type: Number, default: 0 },
  outOfStockNotifiedAt: { type: Date },
  image: { type: String }, // Primary/thumbnail image (backward compatible)
  images: { type: [String], default: [] }, // Array of additional images
  createdAt: { type: Date, default: Date.now }
});

// 🔍 Indexes to speed listing/search
agentProductSchema.index({ agent: 1, createdAt: -1 });
agentProductSchema.index({ category: 1, createdAt: -1 });
agentProductSchema.index({ price: 1 });

module.exports = mongoose.model('AgentProduct', agentProductSchema);
