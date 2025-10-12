// backend/models/Product.js

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: {
    type: String,
    enum: ['Vegetables', 'Grains', 'Provisions',  'Others'],
    default: 'Others'
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  
  image: { type: String }, // store image URL
  inStock: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' } // or Admin later
}, { timestamps: true });



module.exports = mongoose.model('Product', productSchema);
