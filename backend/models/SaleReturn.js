const mongoose = require('mongoose');

const saleReturnSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  returnNumber: {
    type: String,
    required: true,
    trim: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
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
      refundAmount: {
        type: Number,
        required: true,
        min: 0
      }
    }
  ],
  totalRefund: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Completed'],
    default: 'Pending'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

saleReturnSchema.index({ organizationId: 1, returnNumber: 1 }, { unique: true });

module.exports = mongoose.model('SaleReturn', saleReturnSchema);
