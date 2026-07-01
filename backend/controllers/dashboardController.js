const Product = require('../models/Product');
const WarehouseStock = require('../models/WarehouseStock');
const Sale = require('../models/Sale');
const PurchaseOrder = require('../models/PurchaseOrder');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const InventoryMovement = require('../models/InventoryMovement');
const mongoose = require('mongoose');

const getDashboardStats = async (req, res) => {
  try {
    const orgId = req.orgId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Today's Sales
    const todaySalesData = await Sale.find({
      organizationId: orgId,
      createdAt: { $gte: today }
    });
    const todaySales = todaySalesData.reduce((sum, item) => sum + item.total, 0);

    // 2. Today's Purchases
    const todayPurchasesData = await PurchaseOrder.find({
      organizationId: orgId,
      createdAt: { $gte: today }
    });
    const todayPurchases = todayPurchasesData.reduce((sum, item) => sum + item.total, 0);

    // 3. Inventory Value & Cost
    // Fetch all stocks to calculate total items and value
    const stocks = await WarehouseStock.find({ organizationId: orgId }).populate('productId');
    let totalStockQty = 0;
    let inventoryValue = 0;
    let inventoryCost = 0;

    stocks.forEach(stock => {
      if (stock.productId) {
        totalStockQty += stock.quantity;
        inventoryValue += stock.quantity * stock.productId.sellingPrice;
        inventoryCost += stock.quantity * stock.productId.purchasePrice;
      }
    });

    // 4. Pending Orders and Payments counts
    const pendingOrdersCount = await Sale.countDocuments({
      organizationId: orgId,
      deliveryStatus: { $ne: 'Completed' }
    });

    const pendingPaymentsCount = await Sale.countDocuments({
      organizationId: orgId,
      paymentStatus: 'Pending'
    });

    // 5. Expired and Near Expiry Products
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    const expiredProductsCount = await Product.countDocuments({
      organizationId: orgId,
      expiryDate: { $lt: new Date() }
    });

    const nearExpiryProductsCount = await Product.countDocuments({
      organizationId: orgId,
      expiryDate: { $gte: new Date(), $lte: threeMonthsFromNow }
    });

    // 6. Low stock products (total stock < minStock)
    const lowStockAlerts = [];
    const products = await Product.find({ organizationId: orgId });
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const prod of products) {
      const prodStocks = await WarehouseStock.find({ organizationId: orgId, productId: prod._id });
      const totalQty = prodStocks.reduce((sum, s) => sum + s.quantity, 0);
      
      if (totalQty === 0) {
        outOfStockCount++;
        lowStockAlerts.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          stock: 0,
          minStock: prod.minStock,
          status: 'Out of Stock'
        });
      } else if (totalQty <= prod.minStock) {
        lowStockCount++;
        lowStockAlerts.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          stock: totalQty,
          minStock: prod.minStock,
          status: 'Low Stock'
        });
      }
    }

    // 7. Profits and Cost of Goods Sold (COGS)
    // Aggregation of total sales of all time for revenue
    const allSales = await Sale.find({ organizationId: orgId, paymentStatus: 'Paid' }).populate('items.productId');
    let totalRevenue = 0;
    let costOfGoodsSold = 0;

    allSales.forEach(sale => {
      totalRevenue += sale.total;
      sale.items.forEach(item => {
        if (item.productId) {
          costOfGoodsSold += item.quantity * item.productId.purchasePrice;
        }
      });
    });

    const grossProfit = totalRevenue - costOfGoodsSold;
    const netProfit = grossProfit * 0.9; // 10% operational cost estimation

    // 8. Recent Activities Timeline
    const activities = await AuditLog.find({ organizationId: orgId })
      .sort({ timestamp: -1 })
      .limit(10);

    // 9. Calendar Events (Pending deliveries or payment due dates simulated)
    const calendarEvents = [];
    const salesDue = await Sale.find({
      organizationId: orgId,
      paymentStatus: 'Pending'
    }).populate('customerId');

    salesDue.forEach(sale => {
      calendarEvents.push({
        id: sale._id,
        title: `Payment Due: ${sale.invoiceNumber} (${sale.customerId ? sale.customerId.name : 'Unknown'})`,
        date: sale.createdAt,
        type: 'invoice',
        amount: sale.total
      });
    });

    const purchaseDue = await PurchaseOrder.find({
      organizationId: orgId,
      status: { $in: ['Approved', 'Ordered'] }
    }).populate('supplierId');

    purchaseDue.forEach(po => {
      calendarEvents.push({
        id: po._id,
        title: `PO Expected: ${po.poNumber} (${po.supplierId ? po.supplierId.name : 'Unknown'})`,
        date: po.createdAt,
        type: 'purchase',
        amount: po.total
      });
    });

    // 10. Chart Datasets (Grouped by month for the last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0,0,0,0);

    // Monthly Sales & Revenue aggregate
    const monthlySalesAggregate = await Sale.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(orgId),
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          revenue: { $sum: "$total" },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Categories Distribution
    const categoryDistribution = await Product.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "catInfo"
        }
      },
      { $unwind: "$catInfo" },
      {
        $project: {
          name: "$catInfo.name",
          count: 1
        }
      }
    ]);

    // Warehouse stock distribution
    const warehouseStockDistribution = await WarehouseStock.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
      {
        $group: {
          _id: "$warehouseId",
          totalQty: { $sum: "$quantity" }
        }
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "_id",
          foreignField: "_id",
          as: "whInfo"
        }
      },
      { $unwind: "$whInfo" },
      {
        $project: {
          name: "$whInfo.name",
          qty: "$totalQty"
        }
      }
    ]);

    // Stock movement logs aggregate (Area chart)
    const movementTrends = await InventoryMovement.aggregate([
      {
        $match: {
          organizationId: new mongoose.Types.ObjectId(orgId),
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        todaySales,
        todayPurchases,
        inventoryValue,
        inventoryCost,
        grossProfit,
        netProfit,
        pendingOrdersCount,
        pendingPaymentsCount,
        lowStockCount,
        outOfStockCount,
        expiredProductsCount,
        nearExpiryProductsCount,
        totalStockQty
      },
      lowStockAlerts: lowStockAlerts.slice(0, 5),
      activities,
      calendarEvents: calendarEvents.slice(0, 10),
      charts: {
        monthlySales: monthlySalesAggregate,
        categoryDistribution,
        warehouseDistribution: warehouseStockDistribution,
        movementTrends
      }
    });
  } catch (error) {
    console.error(`[DashboardStats] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats
};
