const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const buyerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'buyer' },
    address: { type: String },
    virtualAccount: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  { timestamps: true }
);

// Password hash
buyerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare passwords
buyerSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Buyer', buyerSchema);