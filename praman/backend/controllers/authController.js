const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

// Helper to sign JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || 'praman_super_secret_jwt_key_2026_forensics',
    { expiresIn: '12h' }
  );
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Explicitly query password since it is marked select: false
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    // Generic error to prevent email enumeration
    if (!user || !(await user.comparePassword(password))) {
      await logAudit({
        req,
        action: 'LOGIN_FAILED',
        details: `Failed login attempt for email: ${email}`,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact an administrator.',
      });
    }

    const token = generateToken(user);

    await logAudit({
      req,
      action: 'LOGIN_SUCCESS',
      userId: user._id,
      details: `User ${user.email} logged in successfully`,
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Register new user (Development / Setup helper)
// @route   POST /api/auth/register
// @access  Public (or protected)
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: role || 'investigator',
    });

    const token = generateToken(user);

    await logAudit({
      req,
      action: 'USER_CREATED',
      userId: user._id,
      details: `New user self-registered: ${user.email} (${user.role})`,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    User logout
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await logAudit({
        req,
        action: 'LOGOUT',
        userId: req.user._id,
        details: `User ${req.user.email} logged out`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, register, getMe, logout };
