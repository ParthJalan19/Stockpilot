const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');

// Helper to generate access & refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, orgId: user.organizationId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return { accessToken, refreshToken };
};

// @desc    Register a new Organization and its Super Admin User
// @route   POST /api/auth/register
// @access  Public
const registerOrganization = async (req, res) => {
  const { orgName, name, email, password, subdomain } = req.body;

  if (!orgName || !name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Please enter all required fields' });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Create organization
    const org = await Organization.create({
      name: orgName,
      subdomain: subdomain || orgName.toLowerCase().replace(/[^a-z0-9]/g, '')
    });

    // Create Super Admin User
    const user = await User.create({
      organizationId: org._id,
      name,
      email,
      password,
      role: 'Super Admin',
      permissions: ['all']
    });

    // Seed onboarding defaults: A default warehouse and default category
    await Warehouse.create({
      organizationId: org._id,
      name: 'Main Warehouse A',
      code: 'WH-A',
      address: 'Headquarters Storage'
    });

    await Category.create({
      organizationId: org._id,
      name: 'General',
      description: 'Default Product Category'
    });

    const { accessToken, refreshToken } = generateTokens(user);
    
    // Save refresh token to user database
    user.refreshTokens.push(refreshToken);
    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Organization and administrator account registered successfully',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: org._id
      }
    });
  } catch (error) {
    console.error(`[Register] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Authenticate User & get tokens
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Save login device session history
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    user.loginHistory.unshift({ ip, device: userAgent, date: new Date() });
    
    // Limit log history size to 10 entries
    if (user.loginHistory.length > 10) user.loginHistory.pop();

    user.refreshTokens.push(refreshToken);
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    console.error(`[Login] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token session' });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Swap old refresh token with new one to prevent reuse
    user.refreshTokens = user.refreshTokens.filter(t => t !== refreshToken);
    user.refreshTokens.push(tokens.refreshToken);
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
  }
};

// @desc    Logout user and clear sessions
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  const { refreshToken } = req.body;
  try {
    if (refreshToken) {
      req.user.refreshTokens = req.user.refreshTokens.filter(t => t !== refreshToken);
      await req.user.save();
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -refreshTokens');
    const org = await Organization.findById(req.orgId);
    return res.status(200).json({
      success: true,
      user,
      organization: org
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile details
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  const { name, phone } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    
    // Also save profile avatar path if uploaded
    if (req.file) {
      user.profilePic = `/assets/uploads/${req.file.filename}`;
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePic: user.profilePic
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Please fill in all details' });
  }

  try {
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Simulate Forgot Password Link
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user registered with this email' });
    }

    // In a production SaaS, this generates a token and triggers an email send.
    // For this portfolio model, we will return a simulation response code that details the token link
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log(`[Auth Simulation] Reset password token generated for ${email}: ${resetToken}`);
    
    return res.status(200).json({
      success: true,
      message: 'Password reset link simulated successfully',
      resetLink: `/app/login.html?action=reset&token=${resetToken}`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Simulate Reset Password Action
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and new password are required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = password;
    await user.save();
    return res.status(200).json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Token is invalid or has expired' });
  }
};

module.exports = {
  registerOrganization,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
