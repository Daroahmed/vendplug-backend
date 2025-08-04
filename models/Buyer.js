const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    default: 'buyer'
  },
  virtualAccount: {
    type: String,
    required: false,
    unique: true
 
  }
}, { timestamps: true });

module.exports = mongoose.model('buyer', buyerSchema);
