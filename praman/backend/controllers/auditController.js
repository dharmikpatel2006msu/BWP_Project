const mongoose = require('mongoose');
const { create } = require('xmlbuilder2');
const AuditLog = require('../models/AuditLog');
const Evidence = require('../models/Evidence');
const { logAudit } = require('../utils/auditLogger');

// @desc    Get paginated and filtered audit logs
// @route   GET /api/audit
// @access  Private (Admin)
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, evidenceId, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = userId;
    }

    if (evidenceId) {
      if (mongoose.Types.ObjectId.isValid(evidenceId)) {
        query.evidence = evidenceId;
      } else {
        const ev = await Evidence.findOne({ evidenceId });
        if (ev) {
          query.evidence = ev._id;
        }
      }
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .populate('user', 'name email role')
      .populate('evidence', 'evidenceId title caseNumber')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export audit logs as XML file
// @route   GET /api/audit/export/xml
// @access  Private (Admin)
const exportAuditLogsXml = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({})
      .populate('user', 'name email role')
      .populate('evidence', 'evidenceId title caseNumber')
      .sort({ timestamp: -1 })
      .limit(500); // Sensible limit for XML document

    // Build XML structure with xmlbuilder2
    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('AuditLogs', {
      generatedAt: new Date().toISOString(),
      system: 'P.R.A.M.A.N Digital Evidence System',
      totalRecords: logs.length,
    });

    for (const log of logs) {
      const logNode = root.ele('Log');
      logNode.ele('Action').txt(log.action || 'UNKNOWN');
      logNode.ele('EvidenceId').txt(log.evidence ? log.evidence.evidenceId : 'N/A');
      logNode.ele('CaseNumber').txt(log.evidence ? log.evidence.caseNumber : 'N/A');
      logNode.ele('User').txt(log.user ? `${log.user.name} (${log.user.role})` : 'System');
      logNode.ele('Details').txt(log.details || '');
      logNode.ele('IPAddress').txt(log.ipAddress || '127.0.0.1');
      logNode.ele('Timestamp').txt(log.timestamp ? log.timestamp.toISOString() : '');
    }

    const xmlString = root.end({ prettyPrint: true });

    // Log the XML export event in audit
    await logAudit({
      req,
      action: 'XML_EXPORTED',
      details: `Audit trail exported to XML (${logs.length} records) by ${req.user.name}`,
    });

    res.header('Content-Type', 'application/xml');
    res.attachment('praman-audit-logs.xml');
    return res.send(xmlString);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs,
  exportAuditLogsXml,
};
