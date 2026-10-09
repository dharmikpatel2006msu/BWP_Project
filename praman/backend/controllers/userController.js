const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get all users (with optional role or status filter)
// @route   GET /api/users
// @access  Private (Admin)
const getAllUsers = async (req, res, next) => {
  try {
    const { role, active } = req.query;

    let query = supabase.from('users').select('id, name, email, role, isActive, createdAt').order('createdAt', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }
    if (active !== undefined) {
      query = query.eq('isActive', active === 'true');
    }

    const { data: users, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const formattedUsers = (users || []).map((u) => ({
      ...u,
      _id: u.id,
    }));

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      data: formattedUsers,
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

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
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
        role,
        isActive: true,
        createdAt: new Date().toISOString(),
      })
      .select('id, name, email, role, isActive, createdAt')
      .single();

    if (error || !newUser) {
      throw new Error(error ? error.message : 'Failed to create user');
    }

    await logAudit({
      req,
      action: 'USER_CREATED',
      details: `New ${role} account created: ${newUser.email} by Admin (${req.user.email})`,
    });

    const userObj = {
      ...newUser,
      _id: newUser.id,
    };

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
    const userId = req.params.id;

    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Prevent admin from deactivating their own account
    const currentAdminId = req.user.id || req.user._id;
    if (String(user.id) === String(currentAdminId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    const updatedIsActive = !user.isActive;

    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update({ isActive: updatedIsActive })
      .eq('id', userId)
      .select('id, name, email, role, isActive')
      .single();

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    const action = updatedIsActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
    await logAudit({
      req,
      action,
      details: `Account for ${user.email} was ${updatedIsActive ? 'activated' : 'deactivated'} by ${req.user.email}`,
    });

    res.status(200).json({
      success: true,
      message: `User ${user.email} is now ${updatedIsActive ? 'active' : 'deactivated'}.`,
      data: {
        id: updatedUser.id,
        _id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
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
