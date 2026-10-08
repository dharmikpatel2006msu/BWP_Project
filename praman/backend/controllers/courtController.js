/**
 * P.R.A.M.A.N — Court Officer Controller
 * Manages court evidence intake, integrity verification, judicial review,
 * clarification requests, and report generation.
 *
 * @flow COURT_REVIEW
 * @flow COURT_VERIFY
 * @rule COURT_OFFICER_ONLY
 * @rule ORIGINAL_HASH_IMMUTABLE
 * @rule CUSTODY_HISTORY_READ_ONLY
 * @rule COURT_NOTE_OWNER_ONLY
 */

const fs = require('fs');
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const CustodyLog = require('../models/CustodyLog');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { calculateFileHash } = require('../utils/hashFile');
const { logAudit } = require('../utils/auditLogger');

// Helper to determine if an evidence item is authorized for the court officer
const isAuthorizedForCourt = (evidence, user) => {
  if (user.role === 'admin') return true;
  if (user.role !== 'court_officer') return false;

  // Court officer can only access evidence that has been submitted for court review
  // or explicitly assigned/transferred to them
  const hasCourtStatus = evidence.courtReviewStatus && evidence.courtReviewStatus !== 'None';
  const isAssigned = evidence.courtAssignedTo && evidence.courtAssignedTo.toString() === user._id.toString();
  const isHolder = evidence.currentHolder && evidence.currentHolder.toString() === user._id.toString();

  return hasCourtStatus || isAssigned || isHolder;
};

// Helper to find evidence by _id or evidenceId
const findEvidence = async (idParam) => {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    return await Evidence.findById(idParam);
  }
  return await Evidence.findOne({ evidenceId: idParam });
};

// @desc    Get Court Officer Dashboard Stats
// @route   GET /api/court/stats
// @access  Private (court_officer, admin)
const getCourtDashboardStats = async (req, res, next) => {
  try {
    const courtScopeQuery = { courtReviewStatus: { $ne: 'None' } };

    const [
      submittedToCourt,
      verifiedEvidence,
      pendingCourtReview,
      acceptedEvidence,
      requiresClarification,
      distinctCases,
      recentActivity,
    ] = await Promise.all([
      Evidence.countDocuments(courtScopeQuery),
      Evidence.countDocuments({ ...courtScopeQuery, integrityStatus: 'Verified' }),
      Evidence.countDocuments({ courtReviewStatus: 'Pending Court Review' }),
      Evidence.countDocuments({ courtReviewStatus: 'Accepted for Court Record' }),
      Evidence.countDocuments({ courtReviewStatus: 'Requires Clarification' }),
      Evidence.distinct('caseNumber', courtScopeQuery),
      AuditLog.find({
        action: {
          $in: [
            'COURT_EVIDENCE_VIEWED',
            'COURT_EVIDENCE_VERIFIED',
            'COURT_REVIEW_STARTED',
            'COURT_REVIEW_ACCEPTED',
            'COURT_CLARIFICATION_REQUESTED',
            'COURT_NOTE_ADDED',
          ],
        },
      })
        .populate('user', 'name role')
        .populate('evidence', 'evidenceId caseNumber title')
        .sort({ timestamp: -1 })
        .limit(8),
    ]);

    const recentEvidence = await Evidence.find(courtScopeQuery)
      .populate('uploadedBy', 'name role')
      .populate('currentHolder', 'name role')
      .sort({ updatedAt: -1 })
      .limit(6);

    res.status(200).json({
      success: true,
      data: {
        totalCourtCases: distinctCases.length,
        submittedToCourt,
        verifiedEvidence,
        pendingCourtReview,
        acceptedEvidence,
        requiresClarification,
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

    const query = {
      courtReviewStatus: { $ne: 'None' },
    };

    if (courtStatus) {
      query.courtReviewStatus = courtStatus;
    }

    if (caseNumber) {
      query.caseNumber = { $regex: caseNumber.trim(), $options: 'i' };
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { evidenceId: { $regex: term, $options: 'i' } },
        { caseNumber: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Evidence.countDocuments(query);
    const evidenceList = await Evidence.find(query)
      .populate('uploadedBy', 'name email role')
      .populate('currentHolder', 'name email role')
      .populate('courtReviewedBy', 'name email role')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      count: evidenceList.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      data: evidenceList,
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

    // Strict Scope check: ensure evidence is authorized for court review
    if (!isAuthorizedForCourt(evidence, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Evidence has not been submitted or assigned for court review.',
      });
    }

    const populated = await Evidence.findById(evidence._id)
      .populate('uploadedBy', 'name email role')
      .populate('currentHolder', 'name email role')
      .populate('courtReviewedBy', 'name email role')
      .populate('courtAssignedTo', 'name email role')
      .populate('notes.addedBy', 'name email role');

    await logAudit({
      req,
      action: 'COURT_EVIDENCE_VIEWED',
      evidenceId: evidence._id,
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
// @flow    COURT_VERIFY
// @rule    ORIGINAL_HASH_IMMUTABLE
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

    if (!fs.existsSync(evidence.filePath)) {
      evidence.integrityStatus = 'Failed';
      evidence.lastVerifiedAt = new Date();
      await evidence.save();

      await logAudit({
        req,
        action: 'COURT_EVIDENCE_VERIFIED',
        evidenceId: evidence._id,
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
          verifiedAt: evidence.lastVerifiedAt,
        },
      });
    }

    // Stream-based SHA-256 calculation
    const currentHash = await calculateFileHash(evidence.filePath);

    // Strict comparison without overwriting reference sha256Hash
    const isMatch = currentHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
    const newIntegrityStatus = isMatch ? 'Verified' : 'Failed';

    evidence.integrityStatus = newIntegrityStatus;
    evidence.lastVerifiedAt = new Date();
    await evidence.save();

    // Append to CustodyLog
    await CustodyLog.create({
      evidence: evidence._id,
      action: 'COURT_REVIEWED',
      performedBy: req.user._id,
      remarks: isMatch
        ? `Court Integrity Verification PASSED by ${req.user.name}. SHA-256 matched reference baseline.`
        : `CRITICAL COURT ALERT: SHA-256 hash mismatch during court proceedings review!`,
      timestamp: new Date(),
    });

    // Record Audit
    await logAudit({
      req,
      action: 'COURT_EVIDENCE_VERIFIED',
      evidenceId: evidence._id,
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
        verifiedAt: evidence.lastVerifiedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add Court Review Note
// @route   POST /api/court/evidence/:id/notes
// @access  Private (court_officer, admin)
// @rule    COURT_NOTE_OWNER_ONLY
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

    const newNote = {
      text: text.trim(),
      addedBy: req.user._id,
      addedByName: req.user.name,
      noteType: 'court',
      addedAt: new Date(),
    };

    evidence.notes.push(newNote);
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'NOTE_ADDED',
      performedBy: req.user._id,
      remarks: `Court review note: "${text.trim().substring(0, 70)}"`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'COURT_NOTE_ADDED',
      evidenceId: evidence._id,
      details: `Court note added by ${req.user.name} on ${evidence.evidenceId}`,
    });

    res.status(200).json({
      success: true,
      message: 'Court review note successfully recorded.',
      data: evidence.notes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Accept evidence for court record
// @route   POST /api/court/evidence/:id/accept
// @access  Private (court_officer, admin)
// @flow    COURT_REVIEW
// @rule    ORIGINAL_HASH_IMMUTABLE
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

    evidence.courtReviewStatus = 'Accepted for Court Record';
    evidence.courtReviewedBy = req.user._id;
    evidence.courtReviewedAt = new Date();
    evidence.courtClarificationReason = '';
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'COURT_ACCEPTED',
      performedBy: req.user._id,
      remarks: `Accepted for Court Record by ${req.user.name} (${req.user.role}) under evidentiary compliance guidelines.`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'COURT_REVIEW_ACCEPTED',
      evidenceId: evidence._id,
      details: `Evidence ${evidence.evidenceId} formally ACCEPTED FOR COURT RECORD by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence formally accepted for the official court record.',
      data: evidence,
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

    evidence.courtReviewStatus = 'Requires Clarification';
    evidence.courtClarificationReason = reason.trim();
    evidence.courtReviewedBy = req.user._id;
    evidence.courtReviewedAt = new Date();
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'CLARIFICATION_REQUESTED',
      performedBy: req.user._id,
      remarks: `Court clarification requested: "${reason.trim()}"`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'COURT_CLARIFICATION_REQUESTED',
      evidenceId: evidence._id,
      details: `Court Officer ${req.user.name} requested clarification for ${evidence.evidenceId}: ${reason.trim()}`,
    });

    res.status(200).json({
      success: true,
      message: 'Clarification request registered and audit logged.',
      data: evidence,
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

    evidence.courtReviewStatus = 'Under Court Review';
    evidence.courtReviewedBy = req.user._id;
    await evidence.save();

    await logAudit({
      req,
      action: 'COURT_REVIEW_STARTED',
      evidenceId: evidence._id,
      details: `Court review commenced for ${evidence.evidenceId} by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence is now marked Under Court Review.',
      data: evidence,
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

    // Populate required fields
    const populated = await Evidence.findById(evidence._id)
      .populate('uploadedBy', 'name email role')
      .populate('currentHolder', 'name email role')
      .populate('courtReviewedBy', 'name email role')
      .populate('notes.addedBy', 'name email role');

    // Fetch complete chain of custody
    const custodyTimeline = await CustodyLog.find({ evidence: evidence._id })
      .populate('fromUser', 'name role')
      .populate('toUser', 'name role')
      .populate('performedBy', 'name role')
      .sort({ timestamp: 1 });

    // Separate notes
    const courtNotes = (populated.notes || []).filter(
      (n) => n.noteType === 'court' || (n.addedBy && n.addedBy.role === 'court_officer')
    );
    const investigatorNotes = (populated.notes || []).filter(
      (n) => n.noteType === 'investigator' || (n.addedBy && n.addedBy.role === 'investigator')
    );
    const forensicNotes = (populated.notes || []).filter(
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
        generatedAt: new Date(),
        generatedBy: {
          id: req.user._id,
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
      courtOfficer = await User.findById(courtOfficerId);
      if (!courtOfficer || courtOfficer.role !== 'court_officer') {
        return res.status(400).json({
          success: false,
          message: 'Selected recipient must be an active Court Officer.',
        });
      }
    } else {
      // Find default active court officer
      courtOfficer = await User.findOne({ role: 'court_officer', isActive: true });
    }

    evidence.courtReviewStatus = 'Pending Court Review';
    if (courtOfficer) {
      evidence.courtAssignedTo = courtOfficer._id;
    }
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'SUBMITTED_TO_COURT',
      fromUser: req.user._id,
      toUser: courtOfficer ? courtOfficer._id : null,
      performedBy: req.user._id,
      remarks: remarks ? remarks.trim() : `Evidence formally submitted for judicial court review.`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence._id,
      details: `Evidence ${evidence.evidenceId} submitted to court for review by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Evidence successfully submitted for court review.',
      data: evidence,
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
    const query = {
      action: {
        $in: [
          'COURT_EVIDENCE_VIEWED',
          'COURT_EVIDENCE_VERIFIED',
          'COURT_REVIEW_STARTED',
          'COURT_REVIEW_ACCEPTED',
          'COURT_CLARIFICATION_REQUESTED',
          'COURT_NOTE_ADDED',
        ],
      },
    };

    const logs = await AuditLog.find(query)
      .populate('user', 'name role')
      .populate('evidence', 'evidenceId caseNumber title')
      .sort({ timestamp: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
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
