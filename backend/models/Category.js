const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Category name must be unique within an organization
categorySchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
