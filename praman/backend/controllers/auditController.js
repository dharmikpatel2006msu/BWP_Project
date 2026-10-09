const { create } = require('xmlbuilder2');
const { supabase } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { populateUsers, populateEvidence } = require('../utils/populateHelper');

// @desc    Get paginated and filtered audit logs
// @route   GET /api/audit
// @access  Private (Admin)
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId, evidenceId, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = supabase.from('audit_logs').select('*', { count: 'exact' });

    if (action) {
      query = query.eq('action', action);
    }

    if (userId) {
      query = query.eq('user', userId);
    }

    if (evidenceId) {
      // Find evidence ID by code or check if evidenceId is UUID
      const { data: ev } = await supabase
        .from('evidence')
        .select('id')
        .or(`id.eq.${evidenceId},evidenceId.eq.${evidenceId}`)
        .maybeSingle();

      if (ev) {
        query = query.eq('evidence', ev.id);
      } else {
        query = query.eq('evidence', evidenceId);
      }
    }

    if (startDate) {
      query = query.gte('timestamp', new Date(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte('timestamp', new Date(endDate).toISOString());
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    query = query.order('timestamp', { ascending: false }).range(skip, skip + limitNum - 1);

    const { data: logs, count: total, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    let populated = await populateUsers(logs || [], ['user']);
    populated = await populateEvidence(populated);

    res.status(200).json({
      success: true,
      count: populated.length,
      total: total || 0,
      page: pageNum,
      pages: Math.ceil((total || 0) / limitNum) || 1,
      data: populated,
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
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    let populated = await populateUsers(logs || [], ['user']);
    populated = await populateEvidence(populated);

    const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('AuditLogs', {
      generatedAt: new Date().toISOString(),
      system: 'P.R.A.M.A.N Digital Evidence System',
      totalRecords: populated.length,
    });

    for (const log of populated) {
      const logNode = root.ele('Log');
      logNode.ele('Action').txt(log.action || 'UNKNOWN');
      logNode.ele('EvidenceId').txt(log.evidence && typeof log.evidence === 'object' ? log.evidence.evidenceId : 'N/A');
      logNode.ele('CaseNumber').txt(log.evidence && typeof log.evidence === 'object' ? log.evidence.caseNumber : 'N/A');
      logNode.ele('User').txt(log.user && typeof log.user === 'object' ? `${log.user.name} (${log.user.role})` : 'System');
      logNode.ele('Details').txt(log.details || '');
      logNode.ele('IPAddress').txt(log.ipAddress || '127.0.0.1');
      logNode.ele('Timestamp').txt(log.timestamp ? new Date(log.timestamp).toISOString() : '');
    }

    const xmlString = root.end({ prettyPrint: true });

    await logAudit({
      req,
      action: 'XML_EXPORTED',
      details: `Audit trail exported to XML (${populated.length} records) by ${req.user.name}`,
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
