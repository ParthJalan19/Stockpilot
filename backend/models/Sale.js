const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      variantSku: {
        type: String,
        default: ''
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true,
        min: 0
      }
    }
  ],
  taxGroup: {
    type: String,
    default: 'None'
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Draft', 'Pending', 'Paid'],
    default: 'Draft'
  },
  deliveryStatus: {
    type: String,
    enum: ['Pending', 'Delivered', 'Completed'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

saleSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Sale', saleSchema);
