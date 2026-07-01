const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  logo: {
    type: String,
    default: ''
  },
  gstin: {
    type: String,
    default: '',
    trim: true
  },
  pan: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['INR', 'USD', 'EUR', 'AED']
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  invoicePrefix: {
    type: String,
    default: 'INV-'
  },
  taxRate: {
    type: Number,
    default: 18 // GST percentage by default
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Organization', organizationSchema);
