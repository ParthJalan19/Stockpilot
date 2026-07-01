const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  color: { type: String, default: '' },
  size: { type: String, default: '' },
  storage: { type: String, default: '' },
  ram: { type: String, default: '' },
  weight: { type: String, default: '' },
  skuSuffix: { type: String, required: true },
  additionalPrice: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
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
  sku: {
    type: String,
    required: true,
    trim: true
  },
  barcode: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  minStock: {
    type: Number,
    default: 5,
    min: 0
  },
  maxStock: {
    type: Number,
    default: 100,
    min: 0
  },
  expiryDate: {
    type: Date
  },
  variants: [variantSchema],
  mainImage: {
    type: String,
    default: ''
  },
  galleryImages: {
    type: [String],
    default: []
  },
  documents: [
    {
      name: { type: String, default: '' },
      url: { type: String, default: '' }
    }
  ],
  status: {
    type: String,
    enum: ['Active', 'Draft', 'Archived'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Ensure SKU is unique within each organization
productSchema.index({ organizationId: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
