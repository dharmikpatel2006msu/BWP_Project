const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, toggleUserStatus } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Get all users (Any authenticated user can list active users for transfer recipient dropdowns; full management is admin only)
router.get('/', protect, getAllUsers);

// Admin-only user management
router.post('/', protect, authorize('admin'), createUser);
router.patch('/:id/status', protect, authorize('admin'), toggleUserStatus);

module.exports = router;
