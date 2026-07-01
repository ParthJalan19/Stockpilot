const Organization = require('../models/Organization');
const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Warehouse = require('../models/Warehouse');
const WarehouseStock = require('../models/WarehouseStock');
const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const InventoryAdjustment = require('../models/InventoryAdjustment');
const InventoryMovement = require('../models/InventoryMovement');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get Organization configuration settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const org = await Organization.findById(req.orgId);
    return res.status(200).json({ success: true, settings: org });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Organization configuration settings
// @route   PUT /api/settings
// @access  Private
const updateSettings = async (req, res) => {
  const orgId = req.orgId;
  const { name, currency, timezone, invoicePrefix, taxRate, phone, email, address, gstin, pan } = req.body;

  try {
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization settings not found' });
    }

    const before = org.toObject();

    if (name) org.name = name;
    if (currency) org.currency = currency;
    if (timezone) org.timezone = timezone;
    if (invoicePrefix) org.invoicePrefix = invoicePrefix;
    if (taxRate !== undefined) org.taxRate = parseFloat(taxRate) || 0;
    if (phone !== undefined) org.phone = phone;
    if (email !== undefined) org.email = email;
    if (address !== undefined) org.address = address;
    if (gstin !== undefined) org.gstin = gstin;
    if (pan !== undefined) org.pan = pan;

    // Handle logo upload
    if (req.file) {
      org.logo = `/assets/uploads/${req.file.filename}`;
    }

    const updated = await org.save();

    await logAudit(req, {
      action: 'SETTINGS_UPDATE',
      targetCollection: 'organizations',
      targetId: org._id,
      before,
      after: updated.toObject()
    });

    return res.status(200).json({ success: true, message: 'Settings updated successfully', settings: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download complete tenant backup as JSON file
// @route   GET /api/settings/backup
// @access  Private
const downloadBackup = async (req, res) => {
  const orgId = req.orgId;
  try {
    const backup = {
      organization: await Organization.findById(orgId),
      users: await User.find({ organizationId: orgId }).select('-password -refreshTokens'),
      products: await Product.find({ organizationId: orgId }),
      categories: await Category.find({ organizationId: orgId }),
      suppliers: await Supplier.find({ organizationId: orgId }),
      customers: await Customer.find({ organizationId: orgId }),
      warehouses: await Warehouse.find({ organizationId: orgId }),
      warehouseStocks: await WarehouseStock.find({ organizationId: orgId }),
      sales: await Sale.find({ organizationId: orgId }),
      purchaseOrders: await PurchaseOrder.find({ organizationId: orgId }),
      adjustments: await InventoryAdjustment.find({ organizationId: orgId }),
      movements: await InventoryMovement.find({ organizationId: orgId }),
      notifications: await Notification.find({ organizationId: orgId })
    };

    res.setHeader('Content-disposition', `attachment; filename=stockpilot_backup_${orgId}.json`);
    res.setHeader('Content-type', 'application/json');
    return res.send(JSON.stringify(backup, null, 2));
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Restore tenant backup from JSON file upload
// @route   POST /api/settings/restore
// @access  Private
const restoreBackup = async (req, res) => {
  const orgId = req.orgId;
  const { backupData } = req.body; // Expect parsed JSON backup data

  if (!backupData) {
    return res.status(400).json({ success: false, message: 'Invalid or missing backup restore data' });
  }

  try {
    // 1. Wipe current tenant collections (except organization profile and super admin user)
    await Product.deleteMany({ organizationId: orgId });
    await Category.deleteMany({ organizationId: orgId });
    await Supplier.deleteMany({ organizationId: orgId });
    await Customer.deleteMany({ organizationId: orgId });
    await Warehouse.deleteMany({ organizationId: orgId });
    await WarehouseStock.deleteMany({ organizationId: orgId });
    await Sale.deleteMany({ organizationId: orgId });
    await PurchaseOrder.deleteMany({ organizationId: orgId });
    await InventoryAdjustment.deleteMany({ organizationId: orgId });
    await InventoryMovement.deleteMany({ organizationId: orgId });
    await Notification.deleteMany({ organizationId: orgId });

    // 2. Restore collections mapping the correct organizationId to avoid tenant leaking
    const cleanRestore = (list) => {
      if (!list || !Array.isArray(list)) return [];
      return list.map(item => {
        delete item._id; // Remove original ID so Mongo generates new ones
        item.organizationId = orgId;
        return item;
      });
    };

    if (backupData.categories) await Category.insertMany(cleanRestore(backupData.categories));
    if (backupData.suppliers) await Supplier.insertMany(cleanRestore(backupData.suppliers));
    if (backupData.customers) await Customer.insertMany(cleanRestore(backupData.customers));
    if (backupData.warehouses) await Warehouse.insertMany(cleanRestore(backupData.warehouses));
    if (backupData.products) await Product.insertMany(cleanRestore(backupData.products));
    if (backupData.warehouseStocks) await WarehouseStock.insertMany(cleanRestore(backupData.warehouseStocks));
    if (backupData.sales) await Sale.insertMany(cleanRestore(backupData.sales));
    if (backupData.purchaseOrders) await PurchaseOrder.insertMany(cleanRestore(backupData.purchaseOrders));
    if (backupData.adjustments) await InventoryAdjustment.insertMany(cleanRestore(backupData.adjustments));
    if (backupData.movements) await InventoryMovement.insertMany(cleanRestore(backupData.movements));
    if (backupData.notifications) await Notification.insertMany(cleanRestore(backupData.notifications));

    await logAudit(req, {
      action: 'SETTINGS_RESTORE',
      targetCollection: 'organizations',
      targetId: orgId,
      after: { restoredCollections: Object.keys(backupData) }
    });

    return res.status(200).json({ success: true, message: 'Tenant database restored from backup successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  downloadBackup,
  restoreBackup
};
