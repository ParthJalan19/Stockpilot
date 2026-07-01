const WarehouseTransfer = require('../models/WarehouseTransfer');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all transfers
// @route   GET /api/transfers
// @access  Private
const getTransfers = async (req, res) => {
  const orgId = req.orgId;
  try {
    const transfers = await WarehouseTransfer.find({ organizationId: orgId })
      .populate('sourceWarehouseId', 'name code')
      .populate('destinationWarehouseId', 'name code')
      .populate('items.productId', 'name sku')
      .populate('requestedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, transfers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a warehouse transfer (starts as Draft)
// @route   POST /api/transfers
// @access  Private
const createTransfer = async (req, res) => {
  const orgId = req.orgId;
  const { sourceWarehouseId, destinationWarehouseId, items, notes } = req.body;

  if (!sourceWarehouseId || !destinationWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter source, destination, and at least one item' });
  }

  if (sourceWarehouseId === destinationWarehouseId) {
    return res.status(400).json({ success: false, message: 'Source and destination warehouses cannot be the same' });
  }

  try {
    const trfCount = await WarehouseTransfer.countDocuments({ organizationId: orgId });
    const transferNumber = 'TRF-' + (1000 + trfCount + 1);

    // Validate quantities exist at source warehouse before proceeding
    for (const item of items) {
      const srcStock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId: sourceWarehouseId
      });

      const availableStock = srcStock ? srcStock.quantity - srcStock.reservedQuantity : 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product in source warehouse. Available: ${availableStock}, Requested: ${item.quantity}`
        });
      }
    }

    const transfer = await WarehouseTransfer.create({
      organizationId: orgId,
      transferNumber,
      sourceWarehouseId,
      destinationWarehouseId,
      items,
      notes,
      requestedBy: req.user._id,
      status: 'Draft'
    });

    await logAudit(req, {
      action: 'TRANSFER_CREATE',
      targetCollection: 'warehouse_transfers',
      targetId: transfer._id,
      after: transfer.toObject()
    });

    return res.status(201).json({ success: true, transfer });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Transfer status (Draft -> Pending Approval -> Approved -> Shipped -> Received)
// @route   PUT /api/transfers/:id/status
// @access  Private
const updateTransferStatus = async (req, res) => {
  const orgId = req.orgId;
  const trfId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['Draft', 'Pending Approval', 'Approved', 'Shipped', 'Received', 'Cancelled'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status update request' });
  }

  try {
    const transfer = await WarehouseTransfer.findOne({ organizationId: orgId, _id: trfId });
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status === 'Received' || transfer.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot edit status of a completed or cancelled transfer' });
    }

    const before = transfer.toObject();

    // If status is transitioning to Approved, reserve stock at source
    if (status === 'Approved') {
      transfer.approvedBy = req.user._id;
      for (const item of transfer.items) {
        const srcStock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.sourceWarehouseId
        });

        if (!srcStock || (srcStock.quantity - srcStock.reservedQuantity) < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock in source warehouse to approve transfer.`
          });
        }
        srcStock.reservedQuantity += item.quantity;
        await srcStock.save();
      }
    }

    // If status is transitioning to Shipped, subtract from source warehouse and release reservation
    if (status === 'Shipped' && transfer.status === 'Approved') {
      for (const item of transfer.items) {
        const srcStock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.sourceWarehouseId
        });

        const oldQty = srcStock.quantity;
        srcStock.quantity = Math.max(0, srcStock.quantity - item.quantity);
        srcStock.reservedQuantity = Math.max(0, srcStock.reservedQuantity - item.quantity);
        await srcStock.save();

        // Log Source deduction movement
        await InventoryMovement.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.sourceWarehouseId,
          variantSku: item.variantSku,
          oldQty,
          newQty: srcStock.quantity,
          type: 'Transfer',
          reason: `Transfer Shipped: Out to WH Code (ID: ${transfer.destinationWarehouseId}). Ref: ${transfer.transferNumber}`,
          referenceId: transfer._id,
          updatedBy: req.user._id
        });
      }
    }

    // If status is transitioning to Received, add to destination warehouse stock
    if (status === 'Received') {
      // If was not shipped yet (went straight Approved -> Received), perform deduction first
      if (transfer.status === 'Approved') {
        // Shipped actions (deduct source stock)
        for (const item of transfer.items) {
          const srcStock = await WarehouseStock.findOne({
            organizationId: orgId,
            productId: item.productId,
            warehouseId: transfer.sourceWarehouseId
          });
          const oldQty = srcStock.quantity;
          srcStock.quantity = Math.max(0, srcStock.quantity - item.quantity);
          srcStock.reservedQuantity = Math.max(0, srcStock.reservedQuantity - item.quantity);
          await srcStock.save();

          await InventoryMovement.create({
            organizationId: orgId,
            productId: item.productId,
            warehouseId: transfer.sourceWarehouseId,
            variantSku: item.variantSku,
            oldQty,
            newQty: srcStock.quantity,
            type: 'Transfer',
            reason: `Transfer Shipped & Received: Out to WH ID: ${transfer.destinationWarehouseId}. Ref: ${transfer.transferNumber}`,
            referenceId: transfer._id,
            updatedBy: req.user._id
          });
        }
      }

      // Add to destination warehouse stock
      for (const item of transfer.items) {
        let destStock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.destinationWarehouseId
        });

        if (!destStock) {
          destStock = await WarehouseStock.create({
            organizationId: orgId,
            productId: item.productId,
            warehouseId: transfer.destinationWarehouseId,
            quantity: 0
          });
        }

        const oldQty = destStock.quantity;
        destStock.quantity += item.quantity;
        await destStock.save();

        // Log Destination intake movement
        await InventoryMovement.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.destinationWarehouseId,
          variantSku: item.variantSku,
          oldQty,
          newQty: destStock.quantity,
          type: 'Transfer',
          reason: `Transfer Received: Intake from WH ID: ${transfer.sourceWarehouseId}. Ref: ${transfer.transferNumber}`,
          referenceId: transfer._id,
          updatedBy: req.user._id
        });
      }
    }

    // Cancel logic: release reservation
    if (status === 'Cancelled' && transfer.status === 'Approved') {
      for (const item of transfer.items) {
        const srcStock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: transfer.sourceWarehouseId
        });
        if (srcStock) {
          srcStock.reservedQuantity = Math.max(0, srcStock.reservedQuantity - item.quantity);
          await srcStock.save();
        }
      }
    }

    transfer.status = status === 'Received' ? 'Received' : status;
    await transfer.save();

    await logAudit(req, {
      action: `TRANSFER_${status.toUpperCase().replace(' ', '_')}`,
      targetCollection: 'warehouse_transfers',
      targetId: transfer._id,
      before,
      after: transfer.toObject()
    });

    return res.status(200).json({ success: true, message: `Transfer status updated to ${status}`, transfer });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTransfers,
  createTransfer,
  updateTransferStatus
};
