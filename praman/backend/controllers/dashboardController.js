const Evidence = require('../models/Evidence');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// @desc    Get dashboard metrics, statistics, and recent activity
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalEvidence,
      verifiedEvidence,
      pendingEvidence,
      failedIntegrity,
      totalUsers,
      recentEvidence,
      recentActivity,
      typeAggregations,
    ] = await Promise.all([
      Evidence.countDocuments(),
      Evidence.countDocuments({ integrityStatus: 'Verified' }),
      Evidence.countDocuments({ integrityStatus: 'Not Checked' }),
      Evidence.countDocuments({ integrityStatus: 'Failed' }),
      User.countDocuments({ isActive: true }),
      Evidence.find()
        .populate('uploadedBy', 'name email role')
        .populate('currentHolder', 'name email role')
        .sort({ createdAt: -1 })
        .limit(6),
      AuditLog.find()
        .populate('user', 'name email role')
        .populate('evidence', 'evidenceId caseNumber')
        .sort({ timestamp: -1 })
        .limit(6),
      Evidence.aggregate([
        { $group: { _id: '$evidenceType', count: { $sum: 1 } } },
      ]),
    ]);

    const evidenceByType = {};
    typeAggregations.forEach((item) => {
      evidenceByType[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: {
        totalEvidence,
        verifiedEvidence,
        pendingEvidence,
        failedIntegrity,
        totalUsers,
        evidenceByType,
        recentEvidence,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardStats };
