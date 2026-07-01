const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const WarehouseStock = require('../models/WarehouseStock');
const InventoryMovement = require('../models/InventoryMovement');
const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const { logAudit } = require('../utils/auditLogger');
const fs = require('fs');
const path = require('path');

// @desc    Get all products (Search, filter, paginate, sort)
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  const orgId = req.orgId;
  const { search, category, supplier, status, stockStatus, sortBy, order = 'desc', page = 1, limit = 10 } = req.query;

  try {
    const query = { organizationId: orgId };

    // Search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ];
    }

    // Filters
    if (category) query.category = category;
    if (supplier) query.supplierId = supplier;
    if (status) query.status = status;

    // Fetch products
    let productsList = await Product.find(query)
      .populate('category', 'name')
      .populate('supplierId', 'name company');

    // Filter by stock status in JS after fetching stocks if stockStatus filter is set
    if (stockStatus) {
      const filtered = [];
      for (const prod of productsList) {
        const stocks = await WarehouseStock.find({ organizationId: orgId, productId: prod._id });
        const totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);

        if (stockStatus === 'OutOfStock' && totalStock === 0) {
          filtered.push(prod);
        } else if (stockStatus === 'LowStock' && totalStock > 0 && totalStock <= prod.minStock) {
          filtered.push(prod);
        } else if (stockStatus === 'OverStock' && totalStock > prod.maxStock) {
          filtered.push(prod);
        } else if (stockStatus === 'Normal' && totalStock > prod.minStock && totalStock <= prod.maxStock) {
          filtered.push(prod);
        }
      }
      productsList = filtered;
    }

    // Sort
    const sortField = sortBy || 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    productsList.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      if (typeof valA === 'string') {
        return sortOrder * valA.localeCompare(valB);
      }
      return sortOrder * (valA - valB);
    });

    // Pagination
    const totalCount = productsList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedProducts = productsList.slice(startIndex, endIndex);

    // Get stock quantities for each product
    const results = [];
    for (const prod of paginatedProducts) {
      const stocks = await WarehouseStock.find({ organizationId: orgId, productId: prod._id });
      const totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const reservedStock = stocks.reduce((sum, s) => sum + s.reservedQuantity, 0);
      
      results.push({
        ...prod.toObject(),
        totalStock,
        reservedStock
      });
    }

    return res.status(200).json({
      success: true,
      total: totalCount,
      page: parseInt(page),
      pages: Math.ceil(totalCount / limit),
      products: results
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get product details by ID (with warehouse details, movements, history)
// @route   GET /api/products/:id
// @access  Private
const getProductById = async (req, res) => {
  const orgId = req.orgId;
  const productId = req.params.id;

  try {
    const product = await Product.findOne({ organizationId: orgId, _id: productId })
      .populate('category', 'name')
      .populate('supplierId', 'name company');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Warehouse Stock splits
    const warehouseStocks = await WarehouseStock.find({ organizationId: orgId, productId })
      .populate('warehouseId', 'name code address');

    // Movement History
    const movements = await InventoryMovement.find({ organizationId: orgId, productId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('updatedBy', 'name');

    // Sales Invoice History (where this product was sold)
    const sales = await Sale.find({
      organizationId: orgId,
      'items.productId': productId
    }).sort({ createdAt: -1 }).limit(10).populate('customerId', 'name');

    // Purchase Order History (where this product was ordered)
    const purchases = await PurchaseOrder.find({
      organizationId: orgId,
      'items.productId': productId
    }).sort({ createdAt: -1 }).limit(10).populate('supplierId', 'name');

    return res.status(200).json({
      success: true,
      product,
      warehouseStocks,
      movements,
      sales,
      purchases
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private
const createProduct = async (req, res) => {
  const orgId = req.orgId;
  const {
    name, sku, barcode, description, purchasePrice, sellingPrice,
    category, supplierId, minStock, maxStock, expiryDate, variants
  } = req.body;

  if (!name || !sku || !purchasePrice || !sellingPrice || !category) {
    return res.status(400).json({ success: false, message: 'Please enter all required fields' });
  }

  try {
    const skuExists = await Product.findOne({ organizationId: orgId, sku });
    if (skuExists) {
      return res.status(400).json({ success: false, message: 'Product SKU already exists' });
    }

    // Auto-generate barcode if blank
    const generatedBarcode = barcode || 'SP-' + sku.toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

    // Handle Image uploads via Multer
    let mainImage = '';
    if (req.file) {
      mainImage = `/assets/uploads/${req.file.filename}`;
    }

    const product = await Product.create({
      organizationId: orgId,
      name,
      sku,
      barcode: generatedBarcode,
      description,
      purchasePrice: parseFloat(purchasePrice),
      sellingPrice: parseFloat(sellingPrice),
      category,
      supplierId: supplierId || null,
      minStock: parseInt(minStock) || 0,
      maxStock: parseInt(maxStock) || 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      variants: variants ? JSON.parse(variants) : [],
      mainImage
    });

    // Initialize stock counts (0) for all existing active warehouses
    const warehouses = await WarehouseStock.find({ organizationId: orgId });
    // Keep it empty by default until stocked via PO, Adjustment, or direct write

    // Log operational history
    await logAudit(req, {
      action: 'PRODUCT_CREATE',
      targetCollection: 'products',
      targetId: product._id,
      after: product.toObject()
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res) => {
  const orgId = req.orgId;
  const productId = req.params.id;
  
  try {
    const product = await Product.findOne({ organizationId: orgId, _id: productId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const before = product.toObject();

    // Fields to update
    const fields = [
      'name', 'sku', 'barcode', 'description', 'purchasePrice',
      'sellingPrice', 'category', 'supplierId', 'minStock', 'maxStock', 'status'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    if (req.body.expiryDate !== undefined) {
      product.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
    }

    if (req.body.variants !== undefined) {
      product.variants = typeof req.body.variants === 'string' ? JSON.parse(req.body.variants) : req.body.variants;
    }

    // Handle main image update
    if (req.file) {
      product.mainImage = `/assets/uploads/${req.file.filename}`;
    }

    const updatedProduct = await product.save();

    // Log audit log
    await logAudit(req, {
      action: 'PRODUCT_UPDATE',
      targetCollection: 'products',
      targetId: product._id,
      before,
      after: updatedProduct.toObject()
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a product (Archive or hard delete if no transaction matches)
// @route   DELETE /api/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
  const orgId = req.orgId;
  const productId = req.params.id;

  try {
    const product = await Product.findOne({ organizationId: orgId, _id: productId });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const before = product.toObject();

    // Check if product is in any sales invoices or purchase orders to avoid constraint violation
    const usedInSales = await Sale.countDocuments({ organizationId: orgId, 'items.productId': productId });
    const usedInPurchases = await PurchaseOrder.countDocuments({ organizationId: orgId, 'items.productId': productId });

    if (usedInSales > 0 || usedInPurchases > 0) {
      // Archive instead of delete to keep invoice history intact
      product.status = 'Archived';
      await product.save();
      
      await logAudit(req, {
        action: 'PRODUCT_ARCHIVE',
        targetCollection: 'products',
        targetId: product._id,
        before,
        after: product.toObject()
      });

      return res.status(200).json({
        success: true,
        message: 'Product contains billing histories. Product has been successfully archived instead.'
      });
    }

    // Hard delete since there are no relations
    await Product.deleteOne({ _id: productId });
    await WarehouseStock.deleteMany({ organizationId: orgId, productId });

    await logAudit(req, {
      action: 'PRODUCT_DELETE',
      targetCollection: 'products',
      targetId: productId,
      before
    });

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Import products via CSV
// @route   POST /api/products/import
// @access  Private
const importCSV = async (req, res) => {
  // Simulating CSV parsing inside endpoint for simplicity, creating database records
  const orgId = req.orgId;
  const { products } = req.body; // Array of product objects

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ success: false, message: 'Invalid product list parsed' });
  }

  try {
    const created = [];
    const skipped = [];

    // Find default category
    let defaultCat = await Category.findOne({ organizationId: orgId, name: 'General' });
    if (!defaultCat) {
      defaultCat = await Category.create({ organizationId: orgId, name: 'General', description: 'General imports' });
    }

    for (const item of products) {
      if (!item.name || !item.sku || !item.purchasePrice || !item.sellingPrice) {
        skipped.push({ name: item.name || 'Unknown', sku: item.sku || 'N/A', reason: 'Missing name/sku/prices' });
        continue;
      }

      const exists = await Product.findOne({ organizationId: orgId, sku: item.sku });
      if (exists) {
        skipped.push({ name: item.name, sku: item.sku, reason: 'SKU already exists' });
        continue;
      }

      const barcode = item.barcode || 'SP-' + item.sku.toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);

      const prod = await Product.create({
        organizationId: orgId,
        name: item.name,
        sku: item.sku,
        barcode,
        purchasePrice: parseFloat(item.purchasePrice),
        sellingPrice: parseFloat(item.sellingPrice),
        category: item.category || defaultCat._id,
        minStock: parseInt(item.minStock) || 5,
        maxStock: parseInt(item.maxStock) || 100,
        status: 'Active'
      });

      created.push(prod);
    }

    return res.status(200).json({
      success: true,
      message: `CSV Imported: ${created.length} created, ${skipped.length} skipped`,
      createdCount: created.length,
      skipped
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  importCSV
};
