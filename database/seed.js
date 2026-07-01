require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../backend/models/Organization');
const User = require('../backend/models/User');
const Warehouse = require('../backend/models/Warehouse');
const Category = require('../backend/models/Category');
const Supplier = require('../backend/models/Supplier');
const Customer = require('../backend/models/Customer');
const Product = require('../backend/models/Product');
const WarehouseStock = require('../backend/models/WarehouseStock');
const Sale = require('../backend/models/Sale');
const PurchaseOrder = require('../backend/models/PurchaseOrder');
const InventoryAdjustment = require('../backend/models/InventoryAdjustment');
const InventoryMovement = require('../backend/models/InventoryMovement');
const AuditLog = require('../backend/models/AuditLog');
const Notification = require('../backend/models/Notification');

const seedDatabase = async () => {
  try {
    console.log('[Seeder] Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Seeder] Connected! Wiping database collections...');

    // Wipe collections
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Warehouse.deleteMany({});
    await Category.deleteMany({});
    await Supplier.deleteMany({});
    await Customer.deleteMany({});
    await Product.deleteMany({});
    await WarehouseStock.deleteMany({});
    await Sale.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await InventoryAdjustment.deleteMany({});
    await InventoryMovement.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});

    console.log('[Seeder] Collections wiped clean. Seeding Tenant 1: Apex Electronics...');

    // 1. Create Organization
    const orgApex = await Organization.create({
      name: 'Apex Electronics Corp',
      subdomain: 'apex-electro',
      gstin: '27AAAAA1111A1Z1',
      pan: 'AAAAA1111A',
      address: 'Suite 404, Tech Park, Mumbai, MH, 400001',
      currency: 'USD',
      timezone: 'Asia/Kolkata',
      invoicePrefix: 'APX-INV-',
      taxRate: 18,
      phone: '+91 22 5555 1234',
      email: 'operations@apexelectronics.com'
    });

    const orgId = orgApex._id;

    // 2. Create Users
    console.log('[Seeder] Creating users...');
    const superAdmin = await User.create({
      organizationId: orgId,
      name: 'John CEO',
      email: 'admin@apex.com',
      password: 'password123',
      role: 'Super Admin',
      permissions: ['all']
    });

    const admin = await User.create({
      organizationId: orgId,
      name: 'Jane Admin',
      email: 'jane@apex.com',
      password: 'password123',
      role: 'Admin',
      permissions: ['can_edit_products', 'can_delete_products', 'can_create_sales', 'can_approve_purchase', 'can_manage_users', 'can_export']
    });

    const manager = await User.create({
      organizationId: orgId,
      name: 'Bob Manager',
      email: 'bob@apex.com',
      password: 'password123',
      role: 'Manager',
      permissions: ['can_edit_products', 'can_create_sales', 'can_approve_purchase']
    });

    const employee = await User.create({
      organizationId: orgId,
      name: 'Alice Staff',
      email: 'alice@apex.com',
      password: 'password123',
      role: 'Employee',
      permissions: ['can_create_sales']
    });

    // 3. Create Warehouses
    console.log('[Seeder] Creating Warehouses...');
    const whCentral = await Warehouse.create({
      organizationId: orgId,
      name: 'Central Warehouse A',
      code: 'WH-A',
      address: 'Industrial Plot 12, Kalamboli, Navi Mumbai'
    });

    const whRetail = await Warehouse.create({
      organizationId: orgId,
      name: 'Depot Store B',
      code: 'WH-B',
      address: 'Ground Floor, Galleria Mall, Bandra, Mumbai'
    });

    // 4. Create Categories
    console.log('[Seeder] Creating Categories...');
    const catSmartphones = await Category.create({
      organizationId: orgId,
      name: 'Smartphones',
      description: 'Handheld cellular devices & iPhones'
    });

    const catLaptops = await Category.create({
      organizationId: orgId,
      name: 'Laptops',
      description: 'Professional computing machines and laptops'
    });

    const catAccessories = await Category.create({
      organizationId: orgId,
      name: 'Accessories',
      description: 'Adapters, chargers, covers, and cables'
    });

    // 5. Create Suppliers & Customers
    console.log('[Seeder] Creating Contacts...');
    const supApexWholesale = await Supplier.create({
      organizationId: orgId,
      name: 'Pacific Hardware Distributors',
      company: 'Pacific HW Ltd',
      email: 'sales@pacifichw.com',
      phone: '+1 415 555 9876',
      gstNumber: 'US9928374',
      address: '228 Industrial St, San Francisco, CA, USA',
      rating: 5
    });

    const supLogistics = await Supplier.create({
      organizationId: orgId,
      name: 'Express Logistics Spares',
      company: 'ELS logistics',
      email: 'intakes@els.com',
      phone: '+91 22 6666 4321',
      gstNumber: '27BBBBB2222B2Z2',
      address: 'Depot Rd, Sewri, Mumbai, MH, 400015',
      rating: 4
    });

    const custJohn = await Customer.create({
      organizationId: orgId,
      name: 'John Doe',
      company: 'Doe Retailers',
      email: 'john@doeretail.com',
      phone: '+1 202 555 0143',
      address: '1600 Pennsylvania Ave NW, Washington, DC, USA'
    });

    const custSarah = await Customer.create({
      organizationId: orgId,
      name: 'Sarah Smith',
      company: 'Smith Electronics Store',
      email: 'sarah@smithstore.com',
      phone: '+91 98200 12345',
      address: 'Flat 12B, Sea Breeze Apts, Worli, Mumbai'
    });

    // 6. Create Products with variants
    console.log('[Seeder] Creating Products...');
    const prdIPhone = await Product.create({
      organizationId: orgId,
      name: 'iPhone 15 Pro',
      sku: 'PRD-IP15P',
      barcode: '8806090123456',
      description: 'Flagship Apple smartphone with titanium frame.',
      purchasePrice: 850,
      sellingPrice: 1199,
      category: catSmartphones._id,
      supplierId: supApexWholesale._id,
      minStock: 10,
      maxStock: 80,
      status: 'Active',
      variants: [
        { color: 'Titanium Grey', size: '128GB', skuSuffix: '128G-GRY', additionalPrice: 0 },
        { color: 'Titanium Grey', size: '256GB', skuSuffix: '256G-GRY', additionalPrice: 100 },
        { color: 'Black Onyx', size: '256GB', skuSuffix: '256G-BLK', additionalPrice: 100 }
      ],
      mainImage: '/assets/uploads/iphone.jpg'
    });

    const prdMacBook = await Product.create({
      organizationId: orgId,
      name: 'MacBook Pro M3',
      sku: 'PRD-MBPM3',
      barcode: '8806090678901',
      description: 'High-end workstation laptop with Apple silicon.',
      purchasePrice: 1400,
      sellingPrice: 1999,
      category: catLaptops._id,
      supplierId: supApexWholesale._id,
      minStock: 5,
      maxStock: 30,
      status: 'Active',
      variants: [
        { ram: '16GB', storage: '512GB', skuSuffix: '16R-512G', additionalPrice: 0 },
        { ram: '32GB', storage: '1TB', skuSuffix: '32R-1TB', additionalPrice: 300 }
      ]
    });

    const prdAdapter = await Product.create({
      organizationId: orgId,
      name: 'USB-C Charging Adapter',
      sku: 'PRD-USBC-ADPT',
      barcode: '8806090444333',
      description: '20W Fast Charging socket adapter.',
      purchasePrice: 12,
      sellingPrice: 29,
      category: catAccessories._id,
      supplierId: supLogistics._id,
      minStock: 25,
      maxStock: 200,
      status: 'Active'
    });

    // 7. Seed warehouse stock levels
    console.log('[Seeder] Seeding Stock Levels...');
    // WH-A stocks
    await WarehouseStock.create({ organizationId: orgId, productId: prdIPhone._id, warehouseId: whCentral._id, quantity: 45, reservedQuantity: 0 });
    await WarehouseStock.create({ organizationId: orgId, productId: prdMacBook._id, warehouseId: whCentral._id, quantity: 18, reservedQuantity: 0 });
    await WarehouseStock.create({ organizationId: orgId, productId: prdAdapter._id, warehouseId: whCentral._id, quantity: 120, reservedQuantity: 0 });

    // WH-B stocks (Depot Store)
    await WarehouseStock.create({ organizationId: orgId, productId: prdIPhone._id, warehouseId: whRetail._id, quantity: 15, reservedQuantity: 0 });
    await WarehouseStock.create({ organizationId: orgId, productId: prdMacBook._id, warehouseId: whRetail._id, quantity: 6, reservedQuantity: 0 });
    await WarehouseStock.create({ organizationId: orgId, productId: prdAdapter._id, warehouseId: whRetail._id, quantity: 40, reservedQuantity: 0 });

    // 8. Seed historical Sales (spanning last 6 months)
    console.log('[Seeder] Seeding Sales History...');
    const salesHistory = [];
    const months = [5, 4, 3, 2, 1, 0]; // 6 months of data
    
    for (let index = 0; index < months.length; index++) {
      const m = months[index];
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      
      // Let's create two sales per month with varied pricing
      const s1 = await Sale.create({
        organizationId: orgId,
        invoiceNumber: `APX-INV-100${months.length - m}A`,
        customerId: custJohn._id,
        warehouseId: whCentral._id,
        items: [
          { productId: prdIPhone._id, variantSku: 'PRD-IP15P-256G-GRY', quantity: 2, price: 1299 },
          { productId: prdAdapter._id, variantSku: '', quantity: 3, price: 29 }
        ],
        taxGroup: 'GST',
        tax: 485.46,
        discount: 50,
        total: 3131.46,
        paymentStatus: 'Paid',
        deliveryStatus: 'Completed',
        createdAt: date,
        updatedBy: admin._id
      });
      salesHistory.push(s1);

      const s2 = await Sale.create({
        organizationId: orgId,
        invoiceNumber: `APX-INV-100${months.length - m}B`,
        customerId: custSarah._id,
        warehouseId: whRetail._id,
        items: [
          { productId: prdMacBook._id, variantSku: 'PRD-MBPM3-16R-512G', quantity: 1, price: 1999 }
        ],
        taxGroup: 'GST',
        tax: 359.82,
        discount: 0,
        total: 2358.82,
        paymentStatus: 'Paid',
        deliveryStatus: 'Completed',
        createdAt: date,
        updatedBy: admin._id
      });
      salesHistory.push(s2);
    }

    // Add one pending invoice for current month
    const sPending = await Sale.create({
      organizationId: orgId,
      invoiceNumber: 'APX-INV-1007A',
      customerId: custSarah._id,
      warehouseId: whRetail._id,
      items: [
        { productId: prdIPhone._id, variantSku: 'PRD-IP15P-128G-GRY', quantity: 1, price: 1199 }
      ],
      taxGroup: 'GST',
      tax: 215.82,
      discount: 0,
      total: 1414.82,
      paymentStatus: 'Pending',
      deliveryStatus: 'Pending',
      updatedBy: manager._id
    });

    // 9. Seed historical Purchase Orders
    console.log('[Seeder] Seeding Purchase Orders...');
    for (let index = 0; index < months.length; index++) {
      const m = months[index];
      const date = new Date();
      date.setMonth(date.getMonth() - m);

      await PurchaseOrder.create({
        organizationId: orgId,
        poNumber: `APX-PO-100${months.length - m}A`,
        supplierId: supApexWholesale._id,
        warehouseId: whCentral._id,
        items: [
          { productId: prdIPhone._id, variantSku: 'PRD-IP15P-128G-GRY', quantity: 10, price: 850 },
          { productId: prdMacBook._id, variantSku: 'PRD-MBPM3-16R-512G', quantity: 3, price: 1400 }
        ],
        taxGroup: 'GST',
        tax: 2286.00,
        discount: 100,
        total: 14886.00,
        status: 'Completed',
        createdAt: date,
        updatedBy: admin._id
      });
    }

    // 10. Seed stock adjustments & transfers logs
    console.log('[Seeder] Seeding adjustments and movements...');
    const adj = await InventoryAdjustment.create({
      organizationId: orgId,
      adjustmentNumber: 'ADJ-1001',
      productId: prdAdapter._id,
      warehouseId: whCentral._id,
      adjustedQty: 2,
      type: 'Subtraction',
      reason: 'Damaged',
      status: 'Approved',
      requestedBy: employee._id,
      approvedBy: manager._id,
      notes: 'Crushed box during intake audit'
    });

    // Add movement logs for historical setup
    await InventoryMovement.create({
      organizationId: orgId,
      productId: prdAdapter._id,
      warehouseId: whCentral._id,
      oldQty: 122,
      newQty: 120,
      type: 'Adjustment',
      reason: 'Stock Adjustment: Damaged.',
      referenceId: adj._id,
      updatedBy: manager._id
    });

    // Seed activity audits
    await AuditLog.create({
      organizationId: orgId,
      userId: superAdmin._id,
      userName: superAdmin.name,
      action: 'ORGANIZATION_REGISTER',
      targetCollection: 'organizations',
      targetId: orgId,
      ip: '127.0.0.1',
      device: 'Desktop',
      browser: 'Chrome'
    });

    await AuditLog.create({
      organizationId: orgId,
      userId: admin._id,
      userName: admin.name,
      action: 'PRODUCT_CREATE',
      targetCollection: 'products',
      targetId: prdIPhone._id,
      ip: '127.0.0.1',
      device: 'Desktop',
      browser: 'Chrome'
    });

    // Seed alerts notifications
    await Notification.create({
      organizationId: orgId,
      title: 'Low Stock Alert',
      message: 'Product MacBook Pro M3 is below minStock threshold in warehouse Central Warehouse A.',
      type: 'warning'
    });

    await Notification.create({
      organizationId: orgId,
      title: 'Database Backup Completed',
      message: 'System scheduled backups completed successfully.',
      type: 'success'
    });

    console.log('[Seeder] Tenant 1 seeded successfully!');
    console.log('[Seeder] Database seeding procedure complete!');
    process.exit(0);
  } catch (error) {
    console.error(`[Seeder] Seeding script failure: ${error.message}`);
    process.exit(1);
  }
};

seedDatabase();
