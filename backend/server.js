require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Connect to MongoDB database
connectDB();

const app = express();

// Security Middlewares
app.use(cors());
// Set Helmet header controls (disable CSP for easy loading of external frontend CDNs like GSAP, Chart.js, Lucide)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate Limiting (Prevent Brute-Force and DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  }
});
app.use('/api', limiter);

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/warehouses', require('./routes/warehouseRoutes'));
app.use('/api/adjustments', require('./routes/adjustmentRoutes'));
app.use('/api/transfers', require('./routes/transferRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/purchases', require('./routes/purchaseOrderRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Landing Page Routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/landing/index.html'));
});

// App Entry Redirect
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/app/login.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error] ${err.stack}`);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 404 Fallback routing for non-existent assets/endpoints
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, '../frontend/404.html'));
  } else {
    res.status(404).json({ success: false, message: 'Resource not found' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Server] StockPilot server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
