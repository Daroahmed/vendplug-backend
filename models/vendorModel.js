const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const vendorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  shopName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  
  role: {
    type: String,
    default: 'vendor'
  },

  virtualAccount: {
    type: String,
    unique: true,
    //db.vendors.dropIndex("virtualAccount_1")
 
  },

  // Optional business-related fields
  businessName: { type: String },
  businessAddress: { type: String },
  cacNumber: { type: String }

}, { timestamps: true });

// 🔐 Encrypt password before saving
vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// 🔍 Password match method
vendorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Vendor = mongoose.model('vendor', vendorSchema);
module.exports = Vendor;
