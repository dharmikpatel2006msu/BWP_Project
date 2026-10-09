const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

// Helper to sign JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id || user._id,
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

    const normalizedEmail = email.toLowerCase().trim();

    // Query user by email from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (error || !user || !isMatch) {
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
      userId: user.id,
      details: `User ${user.email} logged in successfully`,
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: user.id,
          _id: user.id,
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

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userId = crypto.randomUUID();

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: role || 'investigator',
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      .select('id, name, email, role, isActive')
      .single();

    if (error || !newUser) {
      throw new Error(error ? error.message : 'Failed to register user');
    }

    const token = generateToken(newUser);

    await logAudit({
      req,
      action: 'USER_CREATED',
      userId: newUser.id,
      details: `New user self-registered: ${newUser.email} (${newUser.role})`,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        token,
        user: {
          id: newUser.id,
          _id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
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
        userId: req.user.id || req.user._id,
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
