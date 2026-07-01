const mongoose = require('mongoose');

const warehouseTransferSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  transferNumber: {
    type: String,
    required: true,
    trim: true
  },
  sourceWarehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  destinationWarehouseId: {
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
      }
    }
  ],
  status: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Approved', 'Shipped', 'Received', 'Cancelled'],
    default: 'Draft'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

warehouseTransferSchema.index({ organizationId: 1, transferNumber: 1 }, { unique: true });

module.exports = mongoose.model('WarehouseTransfer', warehouseTransferSchema);
