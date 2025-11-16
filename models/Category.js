const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    groupName: {
      type: String,
      default: 'Uncategorized',
      trim: true,
    },
    // Which flows should see this category on UI and use it for selection
    type: {
      type: String,
      enum: ['vendor', 'agent', 'both'],
      default: 'both',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);


