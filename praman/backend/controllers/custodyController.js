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

    const { evidenceId, remarks, noteText } = req.body;
    let { toUserId } = req.body;

    if (!evidenceId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide evidenceId.',
      });
    }

    const evidence = await findEvidence(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    // If forensic officer is returning custody and toUserId wasn't explicitly supplied, default to evidence.uploadedBy
    if (!toUserId && req.user.role === 'forensic') {
      toUserId = evidence.uploadedBy;
    }

    if (typeof toUserId === 'object' && toUserId) {
      toUserId = toUserId.id || toUserId._id;
    }

    if (!toUserId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide target recipient (toUserId).',
      });
    }

    // Lock custody transfer while evidence is under judicial court review or accepted into court record
    // Only activated when judge explicitly requests clarification
    if (evidence.courtReviewStatus && evidence.courtReviewStatus !== 'None' && evidence.courtReviewStatus !== 'Requires Clarification') {
      const msg = evidence.courtReviewStatus === 'Accepted for Court Record'
        ? 'Custody transfer is prohibited: This evidence has been formally accepted into the official court record.'
        : `Evidence custody transfer is locked while evidence is under active judicial court review (${evidence.courtReviewStatus}).`;
      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    const currentUserId = req.user.id || req.user._id;

    // Safely extract IDs for comparison
    const evidenceHolderId = String(evidence.currentHolder?.id || evidence.currentHolder?._id || evidence.currentHolder || '');
    const evidenceUploaderId = String(evidence.uploadedBy?.id || evidence.uploadedBy?._id || evidence.uploadedBy || '');
    const currentUserIdStr = String(currentUserId || '');

    // If forensic officer attempts to return evidence that is already held by investigator
    if (req.user.role === 'forensic' && evidenceHolderId === evidenceUploaderId) {
      return res.status(400).json({
        success: false,
        message: 'Evidence custody has already been returned to the primary case investigator.',
      });
    }

    // Role check: Only the current evidence custodian or assigned investigator can transfer
    const isCurrentHolder = Boolean(evidenceHolderId && evidenceHolderId === currentUserIdStr);
    const isUploader = Boolean(evidenceUploaderId && evidenceUploaderId === currentUserIdStr);

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

    const isReturningToUploader = String(recipientUser.id) === evidenceUploaderId;

    if (String(recipientUser.id) === evidenceHolderId) {
      return res.status(400).json({
        success: false,
        message: isReturningToUploader
          ? 'Evidence custody has already been returned to the primary case investigator.'
          : 'Evidence is already in custody of this user.',
      });
    }

    const previousHolderId = evidenceHolderId;
    let newStatus = evidence.status;
    if (isReturningToUploader) {
      newStatus = evidence.integrityStatus === 'Verified' ? 'Verified' : 'Uploaded';
    } else if (evidence.status === 'Uploaded') {
      newStatus = 'Assigned';
    }

    const now = new Date().toISOString();

    // Append forensic/handover note if provided
    let updatedNotes = Array.isArray(evidence.notes) ? [...evidence.notes] : [];
    if (noteText && noteText.trim()) {
      const returnNote = {
        text: noteText.trim(),
        addedBy: currentUserId,
        addedByName: req.user.name,
        noteType: req.user.role === 'forensic' ? 'forensic' : 'investigator',
        addedAt: now,
      };
      updatedNotes.push(returnNote);
    }

    const updatePayload = {
      currentHolder: recipientUser.id,
      status: newStatus,
      updatedAt: now,
    };
    if (noteText && noteText.trim()) {
      updatePayload.notes = updatedNotes;
    }

    // Update evidence current holder and status
    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update(updatePayload)
      .eq('id', evidence.id)
      .select('*')
      .single();

    const custodyEntryId = crypto.randomUUID();
    const custodyAction = isReturningToUploader ? 'CUSTODY_RETURNED' : 'TRANSFERRED';
    const defaultRemarks = isReturningToUploader
      ? `Custody returned to case investigator ${recipientUser.name}`
      : `Transferred to ${recipientUser.name} (${recipientUser.role})`;

    // Create append-only chain of custody entry
    const { data: custodyEntry } = await supabase
      .from('custody_logs')
      .insert({
        id: custodyEntryId,
        evidence: evidence.id,
        action: custodyAction,
        fromUser: previousHolderId,
        toUser: recipientUser.id,
        performedBy: currentUserId,
        remarks: remarks ? remarks.trim() : defaultRemarks,
        timestamp: now,
      })
      .select('*')
      .single();

    // If note was included during return, record as a separate NOTE_ADDED custody event as well
    if (noteText && noteText.trim()) {
      await supabase.from('custody_logs').insert({
        id: crypto.randomUUID(),
        evidence: evidence.id,
        action: 'NOTE_ADDED',
        performedBy: currentUserId,
        remarks: `Handover observation: "${noteText.trim().substring(0, 70)}"`,
        timestamp: now,
      });
    }

    const populatedLog = await populateUsers(custodyEntry, ['fromUser', 'toUser', 'performedBy']);

    // Create Audit Log
    await logAudit({
      req,
      action: isReturningToUploader ? 'EVIDENCE_CUSTODY_RETURNED' : 'EVIDENCE_TRANSFERRED',
      evidenceId: evidence.id,
      details: isReturningToUploader
        ? `Evidence ${evidence.evidenceId} custody returned to case investigator ${recipientUser.name} by ${req.user.name}`
        : `Custody of ${evidence.evidenceId} transferred from user to ${recipientUser.name} (${recipientUser.role})`,
    });

    res.status(200).json({
      success: true,
      message: isReturningToUploader
        ? `Evidence custody successfully returned to case investigator ${recipientUser.name}.`
        : `Evidence custody successfully transferred to ${recipientUser.name}.`,
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
