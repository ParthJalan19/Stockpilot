const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all organization users
// @route   GET /api/users
// @access  Private
const getUsers = async (req, res) => {
  const orgId = req.orgId;
  try {
    const users = await User.find({ organizationId: orgId }).select('-password -refreshTokens');
    return res.status(200).json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add a user to the organization
// @route   POST /api/users
// @access  Private
const createUser = async (req, res) => {
  const orgId = req.orgId;
  const { name, email, password, role, permissions } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Please enter all required fields' });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const user = await User.create({
      organizationId: orgId,
      name,
      email,
      password,
      role,
      permissions: permissions || []
    });

    await logAudit(req, {
      action: 'USER_CREATE',
      targetCollection: 'users',
      targetId: user._id,
      after: { name: user.name, email: user.email, role: user.role, permissions: user.permissions }
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update organization user permissions / role
// @route   PUT /api/users/:id
// @access  Private
const updateUser = async (req, res) => {
  const orgId = req.orgId;
  const userId = req.params.id;
  const { name, email, role, permissions } = req.body;

  try {
    const user = await User.findOne({ organizationId: orgId, _id: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Do not allow editing own role to prevent locking yourself out of admin privileges
    if (req.user._id.toString() === userId.toString() && role && role !== user.role) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    const before = user.toObject();

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (permissions) user.permissions = permissions;

    const updated = await user.save();

    await logAudit(req, {
      action: 'USER_UPDATE',
      targetCollection: 'users',
      targetId: user._id,
      before: { name: before.name, email: before.email, role: before.role, permissions: before.permissions },
      after: { name: updated.name, email: updated.email, role: updated.role, permissions: updated.permissions }
    });

    return res.status(200).json({ success: true, message: 'User settings updated successfully', user: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove user from organization
// @route   DELETE /api/users/:id
// @access  Private
const deleteUser = async (req, res) => {
  const orgId = req.orgId;
  const userId = req.params.id;

  if (req.user._id.toString() === userId.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }

  try {
    const user = await User.findOne({ organizationId: orgId, _id: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const before = user.toObject();

    await User.deleteOne({ _id: userId });

    await logAudit(req, {
      action: 'USER_DELETE',
      targetCollection: 'users',
      targetId: userId,
      before: { name: before.name, email: before.email, role: before.role }
    });

    return res.status(200).json({ success: true, message: 'User removed from organization successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser
};
