const mongoose = require("mongoose");

// Sub-schema for individual items in the order
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "VendorProduct", required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

// Main schema for vendor orders
const vendorOrderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "Buyer", required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected", "preparing", "out_for_delivery", "delivered"], 
    default: "pending" 
  },
  escrow: { type: Boolean, default: false },
  deliveryLocation: { type: String, required: true },
  statusHistory: [
    {
      status: String,
      updatedBy: String, // "buyer" or "vendor"
      timestamp: { type: Date, default: Date.now }
    }
  ]
  
}, { timestamps: true });

module.exports = mongoose.model("VendorOrder", vendorOrderSchema);
