const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    default: 'Agent'
  },
  virtualAccount
: {
    type: String,
    unique: true,
    required: true
  },

}, { timestamps: true });

module.exports = mongoose.model('Agent', agentSchema);
