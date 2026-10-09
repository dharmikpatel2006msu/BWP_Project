const { supabase } = require('../config/db');
const { populateUsers, populateEvidence } = require('../utils/populateHelper');

// @desc    Get dashboard metrics, statistics, and recent activity
// @route   GET /api/dashboard/stats
// @access  Private
const getDashboardStats = async (req, res, next) => {
  try {
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
      supabase.from('evidence').select('*', { count: 'exact', head: true }),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Verified'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Not Checked'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('integrityStatus', 'Failed'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('isActive', true),
      supabase.from('evidence').select('*').order('createdAt', { ascending: false }).limit(6),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(6),
      supabase.from('evidence').select('evidenceType'),
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
