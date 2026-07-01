const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token and attach user to req
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token missing'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists'
      });
    }

    // Attach user and organization context to request
    req.user = user;
    req.orgId = user.organizationId;
    next();
  } catch (error) {
    console.error(`[Auth] JWT Verification failed: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid or expired'
    });
  }
};

// Check if user has one of the allowed roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user ? req.user.role : 'Guest'}) is not authorized to access this resource`
      });
    }
    next();
  };
};

// Check if user has specific permission (Super Admin has all)
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    // Super Admin has absolute access
    if (req.user.role === 'Super Admin') {
      return next();
    }

    // Admins have all permissions by default except super admin configurations
    if (req.user.role === 'Admin') {
      return next();
    }

    // Check specific user permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `You do not have the required permission: ${permission}`
    });
  };
};

module.exports = { protect, restrictTo, hasPermission };
