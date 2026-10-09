const { supabase } = require('../config/db');
const { populateUsers, populateEvidence } = require('../utils/populateHelper');

// @desc    Get dashboard metrics, statistics, and recent activity
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const currentUserId = String(req.user.id || req.user._id);

    let countFilter = supabase.from('evidence').select('*', { count: 'exact', head: true });
    let listQuery = supabase.from('evidence').select('*');
    let typeQuery = supabase.from('evidence').select('evidenceType');

    let verifiedQuery = supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Verified');
    let pendingQuery = supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Not Checked');
    let failedQuery = supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Failed');

    if (userRole === 'forensic') {
      const condition = `currentHolder.eq.${currentUserId},uploadedBy.eq.${currentUserId},courtAssignedTo.eq.${currentUserId}`;
      countFilter = countFilter.or(condition);
      listQuery = listQuery.or(condition);
      typeQuery = typeQuery.or(condition);
      verifiedQuery = verifiedQuery.or(condition);
      pendingQuery = pendingQuery.or(condition);
      failedQuery = failedQuery.or(condition);
    } else if (userRole === 'court_officer') {
      countFilter = countFilter.neq('courtReviewStatus', 'None');
      listQuery = listQuery.neq('courtReviewStatus', 'None');
      typeQuery = typeQuery.neq('courtReviewStatus', 'None');
      verifiedQuery = verifiedQuery.neq('courtReviewStatus', 'None');
      pendingQuery = pendingQuery.neq('courtReviewStatus', 'None');
      failedQuery = failedQuery.neq('courtReviewStatus', 'None');
    }

    const [
      { count: totalEvidence },
      { count: verifiedEvidence },
      { count: pendingEvidence },
      { count: failedIntegrity },
      { count: totalUsers },
      { data: rawRecentEvidence },
      { data: rawRecentActivity },
      { data: typeData },
    ] = await Promise.all([
      countFilter,
      verifiedQuery,
      pendingQuery,
      failedQuery,
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('isActive', true),
      listQuery.order('createdAt', { ascending: false }).limit(6),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(6),
      typeQuery,
    ]);

    const recentEvidence = await populateUsers(rawRecentEvidence || [], ['uploadedBy', 'currentHolder']);
    let recentActivity = await populateUsers(rawRecentActivity || [], ['user']);
    recentActivity = await populateEvidence(recentActivity);

    const evidenceByType = {};
    if (typeData) {
      typeData.forEach((item) => {
        const type = item.evidenceType || 'Other';
        evidenceByType[type] = (evidenceByType[type] || 0) + 1;
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalEvidence: totalEvidence || 0,
        verifiedEvidence: verifiedEvidence || 0,
        pendingEvidence: pendingEvidence || 0,
        failedIntegrity: failedIntegrity || 0,
        totalUsers: totalUsers || 0,
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
