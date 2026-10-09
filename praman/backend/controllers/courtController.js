const fs = require('fs');
const crypto = require('crypto');
const { supabase } = require('../config/db');
const { calculateFileHash } = require('../utils/hashFile');
const { logAudit } = require('../utils/auditLogger');
const { formatRecord, populateUsers, populateEvidence } = require('../utils/populateHelper');

// Helper to determine if an evidence item is authorized for the court officer
const isAuthorizedForCourt = (evidence, user) => {
  if (user.role === 'admin') return true;
  if (user.role !== 'court_officer') return false;

  const currentUserId = String(user.id || user._id);
  const hasCourtStatus = evidence.courtReviewStatus && evidence.courtReviewStatus !== 'None';
  const isAssigned = evidence.courtAssignedTo && String(evidence.courtAssignedTo) === currentUserId;
  const isHolder = evidence.currentHolder && String(evidence.currentHolder) === currentUserId;

  return hasCourtStatus || isAssigned || isHolder;
};

// Helper to find evidence by id or evidenceId
const findEvidence = async (idParam) => {
  const { data } = await supabase
    .from('evidence')
    .select('*')
    .or(`id.eq.${idParam},evidenceId.eq.${idParam}`)
    .maybeSingle();

  return data ? formatRecord(data) : null;
};

// @desc    Get Court Officer Dashboard Stats
// @route   GET /api/court/stats
// @access  Private (court_officer, admin)
const getCourtDashboardStats = async (req, res, next) => {
  try {
    const courtActions = [
      'COURT_EVIDENCE_VIEWED',
      'COURT_EVIDENCE_VERIFIED',
      'COURT_REVIEW_STARTED',
      'COURT_REVIEW_ACCEPTED',
      'COURT_CLARIFICATION_REQUESTED',
      'COURT_NOTE_ADDED',
    ];

    const [
      { count: submittedToCourt },
      { count: verifiedEvidence },
      { count: pendingCourtReview },
      { count: acceptedEvidence },
      { count: requiresClarification },
      { data: caseData },
      { data: rawRecentActivity },
      { data: rawRecentEvidence },
    ] = await Promise.all([
      supabase.from('evidence').select('*', { count: 'exact', head: true }).neq('courtReviewStatus', 'None'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).neq('courtReviewStatus', 'None').eq('integrityStatus', 'Verified'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('courtReviewStatus', 'Pending Court Review'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('courtReviewStatus', 'Accepted for Court Record'),
      supabase.from('evidence').select('*', { count: 'exact', head: true }).eq('courtReviewStatus', 'Requires Clarification'),
      supabase.from('evidence').select('caseNumber').neq('courtReviewStatus', 'None'),
      supabase.from('audit_logs').select('*').in('action', courtActions).order('timestamp', { ascending: false }).limit(8),
      supabase.from('evidence').select('*').neq('courtReviewStatus', 'None').order('updatedAt', { ascending: false }).limit(6),
    ]);

    const distinctCases = new Set((caseData || []).map((c) => c.caseNumber));

    const recentEvidence = await populateUsers(rawRecentEvidence || [], ['uploadedBy', 'currentHolder']);
    let recentActivity = await populateUsers(rawRecentActivity || [], ['user']);
    recentActivity = await populateEvidence(recentActivity);

    res.status(200).json({
      success: true,
      data: {
        totalCourtCases: distinctCases.size,
        submittedToCourt: submittedToCourt || 0,
        verifiedEvidence: verifiedEvidence || 0,
        pendingCourtReview: pendingCourtReview || 0,
        acceptedEvidence: acceptedEvidence || 0,
        requiresClarification: requiresClarification || 0,
        recentEvidence,
        recentActivity,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Court-Assigned Evidence List
// @route   GET /api/court/evidence
// @access  Private (court_officer, admin)
const getCourtEvidenceList = async (req, res, next) => {
  try {
    const { search, courtStatus, caseNumber, page = 1, limit = 10 } = req.query;

    let query = supabase.from('evidence').select('*', { count: 'exact' }).neq('courtReviewStatus', 'None');

    if (courtStatus) {
      query = query.eq('courtReviewStatus', courtStatus);
    }

    if (caseNumber) {
      query = query.ilike('caseNumber', `%${caseNumber.trim()}%`);
    }

    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`title.ilike.%${term}%,evidenceId.ilike.%${term}%,caseNumber.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    query = query.order('updatedAt', { ascending: false }).range(skip, skip + limitNum - 1);

    const { data: evidenceList, count: total, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const populated = await populateUsers(evidenceList || [], ['uploadedBy', 'currentHolder', 'courtReviewedBy']);

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

// @desc    Get single Court Evidence Dossier
// @route   GET /api/court/evidence/:id
// @access  Private (court_officer, admin)
const getCourtEvidenceById = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence has not been submitted or assigned for court review.',
      });
    }

    const populated = await populateUsers(evidence, ['uploadedBy', 'currentHolder', 'courtReviewedBy', 'courtAssignedTo']);

    await logAudit({
      req,
      action: 'COURT_EVIDENCE_VIEWED',
      evidenceId: evidence.id,
      details: `Court Officer ${req.user.name} accessed court dossier for ${evidence.evidenceId}`,
    });

    res.status(200).json({
      success: true,
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify evidence integrity in Court
// @route   POST /api/court/evidence/:id/verify
// @access  Private (court_officer, admin)
const verifyCourtEvidence = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const now = new Date().toISOString();

    if (!fs.existsSync(evidence.filePath)) {
      await supabase
        .from('evidence')
        .update({ integrityStatus: 'Failed', lastVerifiedAt: now })
        .eq('id', evidence.id);

      await logAudit({
        req,
        action: 'COURT_EVIDENCE_VERIFIED',
        evidenceId: evidence.id,
        details: `Court integrity verification FAILED: Physical file missing for ${evidence.evidenceId}`,
      });

      return res.status(200).json({
        success: true,
        message: 'Court Integrity Check: Stored physical file is missing from server storage.',
        data: {
          evidenceId: evidence.evidenceId,
          originalHash: evidence.sha256Hash,
          currentHash: null,
          integrityStatus: 'Failed',
          isMatch: false,
          verifiedBy: req.user.name,
          verifiedAt: now,
        },
      });
    }

    const currentHash = await calculateFileHash(evidence.filePath);
    const isMatch = currentHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
    const newIntegrityStatus = isMatch ? 'Verified' : 'Failed';

    await supabase
      .from('evidence')
      .update({ integrityStatus: newIntegrityStatus, lastVerifiedAt: now })
      .eq('id', evidence.id);

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'COURT_REVIEWED',
      performedBy: currentUserId,
      remarks: isMatch
        ? `Court Integrity Verification PASSED by ${req.user.name}. SHA-256 matched reference baseline.`
        : `CRITICAL COURT ALERT: SHA-256 hash mismatch during court proceedings review!`,
      timestamp: now,
    });

    await logAudit({
      req,
      action: 'COURT_EVIDENCE_VERIFIED',
      evidenceId: evidence.id,
      details: `Court Officer ${req.user.name} verified ${evidence.evidenceId}. Match: ${isMatch}`,
    });

    res.status(200).json({
      success: true,
      message: isMatch
        ? 'INTEGRITY VERIFIED: Evidence hash confirmed authentic.'
        : 'INTEGRITY CHECK FAILED: File digest mismatch detected!',
      data: {
        evidenceId: evidence.evidenceId,
        originalHash: evidence.sha256Hash,
        currentHash,
        integrityStatus: newIntegrityStatus,
        verificationResult: isMatch ? 'INTEGRITY VERIFIED' : 'INTEGRITY CHECK FAILED',
        isMatch,
        verifiedBy: req.user.name,
        verifiedAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add Court Review Note
// @route   POST /api/court/evidence/:id/notes
// @access  Private (court_officer, admin)
const addCourtNote = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Court review note cannot be empty.',
      });
    }

    const evidence = await findEvidence(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const currentUserId = req.user.id || req.user._id;

    const newNote = {
      text: text.trim(),
      addedBy: currentUserId,
      addedByName: req.user.name,
      noteType: 'court',
      addedAt: new Date().toISOString(),
    };

    const currentNotes = Array.isArray(evidence.notes) ? evidence.notes : [];
    const updatedNotes = [...currentNotes, newNote];

    await supabase
      .from('evidence')
      .update({ notes: updatedNotes, updatedAt: new Date().toISOString() })
      .eq('id', evidence.id);

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'NOTE_ADDED',
      performedBy: currentUserId,
      remarks: `Court review note: "${text.trim().substring(0, 70)}"`,
      timestamp: new Date().toISOString(),
    });

    await logAudit({
      req,
      action: 'COURT_NOTE_ADDED',
      evidenceId: evidence.id,
      details: `Court note added by ${req.user.name} on ${evidence.evidenceId}`,
    });

    res.status(200).json({
      success: true,
      message: 'Court review note successfully recorded.',
      data: updatedNotes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Accept evidence for court record
// @route   POST /api/court/evidence/:id/accept
// @access  Private (court_officer, admin)
const acceptForCourtRecord = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const now = new Date().toISOString();

    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update({
        courtReviewStatus: 'Accepted for Court Record',
        courtReviewedBy: currentUserId,
        courtReviewedAt: now,
        courtClarificationReason: '',
        updatedAt: now,
      })
      .eq('id', evidence.id)
      .select('*')
      .single();

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'COURT_ACCEPTED',
      performedBy: currentUserId,
      remarks: `Accepted for Court Record by ${req.user.name} (${req.user.role}) under evidentiary compliance guidelines.`,
      timestamp: now,
    });

    await logAudit({
      req,
      action: 'COURT_REVIEW_ACCEPTED',
      evidenceId: evidence.id,
      details: `Evidence ${evidence.evidenceId} formally ACCEPTED FOR COURT RECORD by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence formally accepted for the official court record.',
      data: formatRecord(updatedEvidence || evidence),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Request Clarification from investigator/forensics
// @route   POST /api/court/evidence/:id/clarification
// @access  Private (court_officer, admin)
const requestClarification = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A clarification reason is required. Reason cannot be blank.',
      });
    }

    const evidence = await findEvidence(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const now = new Date().toISOString();

    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update({
        courtReviewStatus: 'Requires Clarification',
        courtClarificationReason: reason.trim(),
        courtReviewedBy: currentUserId,
        courtReviewedAt: now,
        updatedAt: now,
      })
      .eq('id', evidence.id)
      .select('*')
      .single();

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'CLARIFICATION_REQUESTED',
      performedBy: currentUserId,
      remarks: `Court clarification requested: "${reason.trim()}"`,
      timestamp: now,
    });

    await logAudit({
      req,
      action: 'COURT_CLARIFICATION_REQUESTED',
      evidenceId: evidence.id,
      details: `Court Officer ${req.user.name} requested clarification for ${evidence.evidenceId}: ${reason.trim()}`,
    });

    res.status(200).json({
      success: true,
      message: 'Clarification request registered and audit logged.',
      data: formatRecord(updatedEvidence || evidence),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Start Court Review
// @route   POST /api/court/evidence/:id/start-review
// @access  Private (court_officer, admin)
const startCourtReview = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const now = new Date().toISOString();

    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update({
        courtReviewStatus: 'Under Court Review',
        courtReviewedBy: currentUserId,
        updatedAt: now,
      })
      .eq('id', evidence.id)
      .select('*')
      .single();

    await logAudit({
      req,
      action: 'COURT_REVIEW_STARTED',
      evidenceId: evidence.id,
      details: `Court review commenced for ${evidence.evidenceId} by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence is now marked Under Court Review.',
      data: formatRecord(updatedEvidence || evidence),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Court Evidence Review Report Data
// @route   GET /api/court/evidence/:id/report
// @access  Private (court_officer, admin)
const getCourtEvidenceReport = async (req, res, next) => {
  try {
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence is not in court review scope.',
      });
    }

    const populated = await populateUsers(evidence, ['uploadedBy', 'currentHolder', 'courtReviewedBy']);

    const { data: rawLogs } = await supabase
      .from('custody_logs')
      .select('*')
      .eq('evidence', evidence.id)
      .order('timestamp', { ascending: true });

    const custodyTimeline = await populateUsers(rawLogs || [], ['fromUser', 'toUser', 'performedBy']);

    const notesList = Array.isArray(populated.notes) ? populated.notes : [];
    const courtNotes = notesList.filter(
      (n) => n.noteType === 'court' || (n.addedBy && n.addedBy.role === 'court_officer')
    );
    const investigatorNotes = notesList.filter(
      (n) => n.noteType === 'investigator' || (n.addedBy && n.addedBy.role === 'investigator')
    );
    const forensicNotes = notesList.filter(
      (n) => n.noteType === 'forensic' || (n.addedBy && n.addedBy.role === 'forensic')
    );

    res.status(200).json({
      success: true,
      data: {
        evidence: populated,
        custodyTimeline,
        notesBreakdown: {
          courtNotes,
          investigatorNotes,
          forensicNotes,
        },
        generatedAt: new Date().toISOString(),
        generatedBy: {
          id: req.user.id || req.user._id,
          name: req.user.name,
          role: req.user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit / Assign Evidence to Court (Called by Investigator, Forensic, or Admin)
// @route   POST /api/court/submit/:id
// @access  Private (admin, investigator, forensic)
const submitEvidenceToCourt = async (req, res, next) => {
  try {
    const { courtOfficerId, remarks } = req.body;
    const evidence = await findEvidence(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    let courtOfficer = null;
    if (courtOfficerId) {
      const { data: officer } = await supabase
        .from('users')
        .select('*')
        .eq('id', courtOfficerId)
        .maybeSingle();

      if (!officer || officer.role !== 'court_officer') {
        return res.status(400).json({
          success: false,
          message: 'Selected recipient must be an active Court Officer.',
        });
      }
      courtOfficer = officer;
    } else {
      const { data: defaultOfficer } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'court_officer')
        .eq('isActive', true)
        .limit(1)
        .maybeSingle();

      courtOfficer = defaultOfficer;
    }

    const currentUserId = req.user.id || req.user._id;
    const now = new Date().toISOString();

    const updatePayload = {
      courtReviewStatus: 'Pending Court Review',
      updatedAt: now,
    };
    if (courtOfficer) {
      updatePayload.courtAssignedTo = courtOfficer.id;
    }

    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update(updatePayload)
      .eq('id', evidence.id)
      .select('*')
      .single();

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'SUBMITTED_TO_COURT',
      fromUser: currentUserId,
      toUser: courtOfficer ? courtOfficer.id : null,
      performedBy: currentUserId,
      remarks: remarks ? remarks.trim() : `Evidence formally submitted for judicial court review.`,
      timestamp: now,
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence.id,
      details: `Evidence ${evidence.evidenceId} submitted to court for review by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence successfully submitted for court review.',
      data: formatRecord(updatedEvidence || evidence),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Court Audit Logs (Only court-relevant events)
// @route   GET /api/court/audit
// @access  Private (court_officer, admin)
const getCourtAuditLogs = async (req, res, next) => {
  try {
    const courtActions = [
      'COURT_EVIDENCE_VIEWED',
      'COURT_EVIDENCE_VERIFIED',
      'COURT_REVIEW_STARTED',
      'COURT_REVIEW_ACCEPTED',
      'COURT_CLARIFICATION_REQUESTED',
      'COURT_NOTE_ADDED',
    ];

    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', courtActions)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(error.message);
    }

    let populated = await populateUsers(logs || [], ['user']);
    populated = await populateEvidence(populated);

    res.status(200).json({
      success: true,
      count: populated.length,
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCourtDashboardStats,
  getCourtEvidenceList,
  getCourtEvidenceById,
  verifyCourtEvidence,
  addCourtNote,
  acceptForCourtRecord,
  requestClarification,
  startCourtReview,
  getCourtEvidenceReport,
  submitEvidenceToCourt,
  getCourtAuditLogs,
};
