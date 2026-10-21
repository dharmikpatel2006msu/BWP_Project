const crypto = require('crypto');
const { supabase } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');
const { formatRecord, populateUsers } = require('../utils/populateHelper');

// Helper to find evidence by id or evidenceId
const findEvidence = async (idParam) => {
  const { data } = await supabase
    .from('evidence')
    .select('*')
    .or(`id.eq.${idParam},evidenceId.eq.${idParam}`)
    .maybeSingle();

  return data ? formatRecord(data) : null;
};

// @desc    Get complete chain of custody timeline for an evidence item
// @route   GET /api/custody/:evidenceId
// @access  Private
const getCustodyLogsByEvidence = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.evidenceId);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    const { data: logs, error } = await supabase
      .from('custody_logs')
      .select('*')
      .eq('evidence', evidence.id)
      .order('timestamp', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const populatedLogs = await populateUsers(logs || [], ['fromUser', 'toUser', 'performedBy']);

    res.status(200).json({
      success: true,
      data: {
        evidence: {
          _id: evidence.id,
          id: evidence.id,
          evidenceId: evidence.evidenceId,
          title: evidence.title,
          caseNumber: evidence.caseNumber,
          currentHolder: evidence.currentHolder,
          status: evidence.status,
          integrityStatus: evidence.integrityStatus,
        },
        timeline: populatedLogs,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Transfer evidence custody to another authorized user (Investigator / Forensic)
// @route   POST /api/custody/transfer
// @access  Private (Investigator, Forensic, currentHolder)
const transferEvidence = async (req, res, next) => {
  try {
    // Strict Limitation: System Admin is an observer and CANNOT alter chain of custody
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: To preserve legal credibility, System Admin cannot manually alter the chain of custody.',
      });
    }

    const { evidenceId, toUserId, remarks } = req.body;

    if (!evidenceId || !toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both evidenceId and target recipient (toUserId).',
      });
    }

    const evidence = await findEvidence(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    const currentUserId = req.user.id || req.user._id;

    // Role check: Only the current evidence custodian or assigned investigator can transfer
    const isCurrentHolder = String(evidence.currentHolder) === String(currentUserId);
    const isUploader = String(evidence.uploadedBy) === String(currentUserId);

    if (!isCurrentHolder && !isUploader) {
      return res.status(403).json({
        success: false,
        message: 'Only the current evidence custodian or case investigator can initiate a transfer.',
      });
    }

    // Verify recipient user
    const { data: recipientUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', toUserId)
      .maybeSingle();

    if (!recipientUser || !recipientUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected recipient user is invalid or currently deactivated.',
      });
    }

    if (String(recipientUser.id) === String(evidence.currentHolder)) {
      return res.status(400).json({
        success: false,
        message: 'Evidence is already in custody of this user.',
      });
    }

    const previousHolderId = evidence.currentHolder;
    const newStatus = evidence.status === 'Uploaded' ? 'Assigned' : evidence.status;
    const now = new Date().toISOString();

    // Update evidence current holder and status
    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update({
        currentHolder: recipientUser.id,
        status: newStatus,
        updatedAt: now,
      })
      .eq('id', evidence.id)
      .select('*')
      .single();

    const custodyEntryId = crypto.randomUUID();

    // Create append-only chain of custody entry
    const { data: custodyEntry } = await supabase
      .from('custody_logs')
      .insert({
        id: custodyEntryId,
        evidence: evidence.id,
        action: 'TRANSFERRED',
        fromUser: previousHolderId,
        toUser: recipientUser.id,
        performedBy: currentUserId,
        remarks: remarks ? remarks.trim() : `Transferred to ${recipientUser.name} (${recipientUser.role})`,
        timestamp: now,
      })
      .select('*')
      .single();

    const populatedLog = await populateUsers(custodyEntry, ['fromUser', 'toUser', 'performedBy']);

    // Create Audit Log
    await logAudit({
      req,
      action: 'EVIDENCE_TRANSFERRED',
      evidenceId: evidence.id,
      details: `Custody of ${evidence.evidenceId} transferred from user to ${recipientUser.name} (${recipientUser.role})`,
    });

    res.status(200).json({
      success: true,
      message: `Evidence custody successfully transferred to ${recipientUser.name}.`,
      data: {
        evidence: formatRecord(updatedEvidence || evidence),
        custodyRecord: populatedLog,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCustodyLogsByEvidence,
  transferEvidence,
};
