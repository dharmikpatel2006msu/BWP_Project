const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all users (with optional role or status filter)
// @route   GET /api/users
// @access  Private (Admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, active } = req.query;
    const query = {};

    if (role) query.role = role;
    if (active !== undefined) query.isActive = active === 'true';

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new user by administrator
// @route   POST /api/users
// @access  Private (Admin)
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are all required fields.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
      isActive: true,
    });

    await logAudit({
      req,
      action: 'USER_CREATED',
      details: `New ${role} account created: ${newUser.email} by Admin (${req.user.email})`,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({
      success: true,
      message: `User ${newUser.name} created successfully.`,
      data: userObj,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle or update user active status (deactivate/activate)
// @route   PATCH /api/users/:id/status
// @access  Private (Admin)
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Prevent admin from deactivating their own account
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    // Toggle isActive
    user.isActive = !user.isActive;
    await user.save();

    const action = user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
    await logAudit({
      req,
      action,
      details: `Account for ${user.email} was ${user.isActive ? 'activated' : 'deactivated'} by ${req.user.email}`,
    });

    res.status(200).json({
      success: true,
      message: `User ${user.email} is now ${user.isActive ? 'active' : 'deactivated'}.`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  createUser,
  toggleUserStatus,
};
