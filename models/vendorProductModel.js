const mongoose = require('mongoose');

const vendorProductSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String },
  image: { type: String }, // will store image path
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VendorProduct', vendorProductSchema);
