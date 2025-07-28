const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    default: 'agent'
  },
  virtualAccount
: {
    type: String,
    unique: true,
    required: true
  },
  wallet: {
    balance: {
      type: Number,
      default: 0
    },
    bankName: {
      type: String,
      default: "VendPlug Microfinance Bank"
    },
    accountName: {
      type: String,
      default: function () {
        return this.fullName;
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Agent', agentSchema);
