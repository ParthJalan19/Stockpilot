const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const Organization = require('../models/Organization');
const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all sales invoices
// @route   GET /api/sales
// @access  Private
const getSales = async (req, res) => {
  const orgId = req.orgId;
  try {
    const sales = await Sale.find({ organizationId: orgId })
      .populate('customerId', 'name company email phone')
      .populate('warehouseId', 'name code')
      .populate('items.productId', 'name sku purchasePrice')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, sales });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a sale invoice (Draft / Pending)
// @route   POST /api/sales
// @access  Private
const createSale = async (req, res) => {
  const orgId = req.orgId;
  const { customerId, warehouseId, items, taxGroup, discount, paymentStatus, deliveryStatus, notes } = req.body;

  if (!customerId || !warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter customer, warehouse, and at least one item' });
  }

  try {
    const org = await Organization.findById(orgId);
    const invoicePrefix = org ? org.invoicePrefix : 'INV-';
    const saleCount = await Sale.countDocuments({ organizationId: orgId });
    const invoiceNumber = invoicePrefix + (1000 + saleCount + 1);

    // Calculate totals
    let itemsSubtotal = 0;
    for (const item of items) {
      const prod = await Product.findOne({ organizationId: orgId, _id: item.productId });
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }
      itemsSubtotal += item.quantity * item.price;

      // Check stock availability
      const stock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId
      });

      const availableQty = stock ? stock.quantity - stock.reservedQuantity : 0;
      if (availableQty < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product ${prod.name}. Available: ${availableQty}, Requested: ${item.quantity}`
        });
      }
    }

    const discountAmount = parseFloat(discount) || 0;
    const taxRate = org ? org.taxRate : 18;
    const taxAmount = ((itemsSubtotal - discountAmount) * taxRate) / 100;
    const total = itemsSubtotal - discountAmount + taxAmount;

    // Create Invoice
    const sale = await Sale.create({
      organizationId: orgId,
      invoiceNumber,
      customerId,
      warehouseId,
      items,
      taxGroup: taxGroup || 'GST',
      tax: taxAmount,
      discount: discountAmount,
      total,
      paymentStatus: paymentStatus || 'Pending',
      deliveryStatus: deliveryStatus || 'Pending',
      notes,
      updatedBy: req.user._id
    });

    // Stock Reservation: Reserve items
    for (const item of items) {
      let stock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId
      });

      if (!stock) {
        stock = await WarehouseStock.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId,
          quantity: 0
        });
      }

      stock.reservedQuantity += item.quantity;
      await stock.save();
    }

    // Auto-commit stock deduction if paymentStatus is Paid or deliveryStatus is Completed/Delivered
    if (paymentStatus === 'Paid' || deliveryStatus === 'Delivered' || deliveryStatus === 'Completed') {
      for (const item of items) {
        const stock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId
        });

        const oldQty = stock.quantity;
        stock.quantity = Math.max(0, stock.quantity - item.quantity);
        stock.reservedQuantity = Math.max(0, stock.reservedQuantity - item.quantity); // Release reservation
        await stock.save();

        // Log movement ledger
        await InventoryMovement.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId,
          variantSku: item.variantSku || '',
          oldQty,
          newQty: stock.quantity,
          type: 'Sale',
          reason: `Invoice Generated: Sold to Cust ID: ${customerId}. Ref: ${invoiceNumber}`,
          referenceId: sale._id,
          updatedBy: req.user._id
        });
      }
    }

    await logAudit(req, {
      action: 'SALE_CREATE',
      targetCollection: 'sales',
      targetId: sale._id,
      after: sale.toObject()
    });

    return res.status(201).json({ success: true, message: 'Sale invoice created successfully', sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Invoice Payment / Delivery status
// @route   PUT /api/sales/:id/status
// @access  Private
const updateSaleStatus = async (req, res) => {
  const orgId = req.orgId;
  const saleId = req.params.id;
  const { paymentStatus, deliveryStatus } = req.body;

  try {
    const sale = await Sale.findOne({ organizationId: orgId, _id: saleId });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const before = sale.toObject();
    const oldPaymentStatus = sale.paymentStatus;
    const oldDeliveryStatus = sale.deliveryStatus;

    if (paymentStatus) sale.paymentStatus = paymentStatus;
    if (deliveryStatus) sale.deliveryStatus = deliveryStatus;

    // Deduct stock if transitions from Pending -> Paid, or delivery becomes Delivered/Completed
    const shouldDeductStock = 
      (paymentStatus === 'Paid' && oldPaymentStatus !== 'Paid') ||
      ((deliveryStatus === 'Delivered' || deliveryStatus === 'Completed') && 
       (oldDeliveryStatus !== 'Delivered' && oldDeliveryStatus !== 'Completed'));

    if (shouldDeductStock && oldPaymentStatus !== 'Paid' && oldDeliveryStatus !== 'Delivered' && oldDeliveryStatus !== 'Completed') {
      for (const item of sale.items) {
        const stock = await WarehouseStock.findOne({
          organizationId: orgId,
          productId: item.productId,
          warehouseId: sale.warehouseId
        });

        if (stock) {
          const oldQty = stock.quantity;
          stock.quantity = Math.max(0, stock.quantity - item.quantity);
          stock.reservedQuantity = Math.max(0, stock.reservedQuantity - item.quantity); // Release reservation
          await stock.save();

          await InventoryMovement.create({
            organizationId: orgId,
            productId: item.productId,
            warehouseId: sale.warehouseId,
            variantSku: item.variantSku || '',
            oldQty,
            newQty: stock.quantity,
            type: 'Sale',
            reason: `Invoice Processed: ${sale.invoiceNumber}`,
            referenceId: sale._id,
            updatedBy: req.user._id
          });
        }
      }
    }

    await sale.save();

    await logAudit(req, {
      action: 'SALE_STATUS_UPDATE',
      targetCollection: 'sales',
      targetId: sale._id,
      before,
      after: sale.toObject()
    });

    return res.status(200).json({ success: true, message: 'Invoice status updated successfully', sale });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get sale returns
// @route   GET /api/sales/returns
// @access  Private
const getSaleReturns = async (req, res) => {
  const orgId = req.orgId;
  try {
    const returns = await SaleReturn.find({ organizationId: orgId })
      .populate('saleId', 'invoiceNumber')
      .populate('warehouseId', 'name code')
      .populate('items.productId', 'name sku')
      .populate('updatedBy', 'name')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, returns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Log a sales return (restores items to warehouse stock)
// @route   POST /api/sales/returns
// @access  Private
const createSaleReturn = async (req, res) => {
  const orgId = req.orgId;
  const { saleId, warehouseId, items, reason } = req.body;

  if (!saleId || !warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Please enter invoice, warehouse, and items returned' });
  }

  try {
    const returnCount = await SaleReturn.countDocuments({ organizationId: orgId });
    const returnNumber = 'RET-SL-' + (1000 + returnCount + 1);

    let totalRefund = 0;
    const itemsList = [];

    for (const item of items) {
      const prod = await Product.findOne({ organizationId: orgId, _id: item.productId });
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }
      const refundAmt = item.quantity * prod.sellingPrice;
      totalRefund += refundAmt;

      itemsList.push({
        productId: item.productId,
        variantSku: item.variantSku || '',
        quantity: parseInt(item.quantity),
        refundAmount: refundAmt
      });
    }

    const saleReturn = await SaleReturn.create({
      organizationId: orgId,
      returnNumber,
      saleId,
      warehouseId,
      items: itemsList,
      totalRefund,
      reason,
      status: 'Completed',
      updatedBy: req.user._id
    });

    // Update stock levels & record movements
    for (const item of itemsList) {
      let stock = await WarehouseStock.findOne({
        organizationId: orgId,
        productId: item.productId,
        warehouseId
      });

      if (!stock) {
        stock = await WarehouseStock.create({
          organizationId: orgId,
          productId: item.productId,
          warehouseId,
          quantity: 0
        });
      }

      const oldQty = stock.quantity;
      stock.quantity += item.quantity;
      await stock.save();

      await InventoryMovement.create({
        organizationId: orgId,
        productId: item.productId,
        warehouseId,
        variantSku: item.variantSku,
        oldQty,
        newQty: stock.quantity,
        type: 'Return',
        reason: `Sales Return Logged: Customer refund. Ref: ${returnNumber}`,
        referenceId: saleReturn._id,
        updatedBy: req.user._id
      });
    }

    await logAudit(req, {
      action: 'SALE_RETURN_CREATE',
      targetCollection: 'sales_returns',
      targetId: saleReturn._id,
      after: saleReturn.toObject()
    });

    return res.status(201).json({ success: true, message: 'Sales return logged and stock restored successfully', saleReturn });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSales,
  createSale,
  updateSaleStatus,
  getSaleReturns,
  createSaleReturn
};
