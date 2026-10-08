const AuditLog = require('../models/AuditLog');

/**
 * Creates an audit log entry in MongoDB
 * @param {Object} options
 * @param {Object} options.req - Express request object (extracts user and ip)
 * @param {string} options.action - Audit action enum
 * @param {string} [options.evidenceId] - Associated evidence document _id
 * @param {string} [options.details] - Human-readable details
 * @param {string} [options.userId] - Explicit user _id if not in req.user
 */
const logAudit = async ({ req, action, evidenceId = null, details = '', userId = null }) => {
  try {
    const finalUserId = userId || (req && req.user ? req.user._id : null);
    let ipAddress = '127.0.0.1';
    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    }

    await AuditLog.create({
      user: finalUserId,
      action,
      evidence: evidenceId,
      details,
      ipAddress: String(ipAddress),
      timestamp: new Date(),
    });
  } catch (err) {
    console.error(`[PRAMAN Audit Error] Failed to write audit log for ${action}:`, err.message);
  }
};

module.exports = { logAudit };
