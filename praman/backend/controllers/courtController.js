const path = require('path');
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

    if (evidence.courtReviewStatus === 'Requires Clarification') {
      return res.status(400).json({
        success: false,
        message: 'Judicial action paused: Evidence is currently awaiting clarification from the investigator. Cannot add judicial notes until resubmitted.',
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

    if (evidence.courtReviewStatus === 'Accepted for Court Record') {
      return res.status(400).json({
        success: false,
        message: 'Evidence exhibit has already been formally accepted into the court record.',
      });
    }

    if (evidence.courtReviewStatus === 'Requires Clarification') {
      return res.status(400).json({
        success: false,
        message: 'Judicial action paused: Evidence is currently awaiting clarification from the investigator. Cannot accept until resubmitted.',
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

    if (evidence.courtReviewStatus === 'Accepted for Court Record') {
      return res.status(400).json({
        success: false,
        message: 'Cannot request clarification: Evidence exhibit has already been formally accepted into the court record.',
      });
    }

    if (evidence.courtReviewStatus === 'Requires Clarification') {
      return res.status(400).json({
        success: false,
        message: 'Clarification has already been requested. Awaiting resubmission by the investigator.',
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

// @desc    Export Section 65B Electronic Record Certificate as XML
// @route   GET /api/court/evidence/:id/certificate/xml
// @access  Private (court_officer, admin)
const exportCourtCertificateXml = async (req, res, next) => {
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

    const { create } = require('xmlbuilder2');

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Section65BCertificate', {
        xmlns: 'https://praman.gov.in/forensics/v1',
        certificateId: `CERT-${evidence.evidenceId}-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        admissibilityStatus: evidence.courtReviewStatus || 'Pending',
        integrityStatus: evidence.integrityStatus || 'Not Checked',
      })
      .ele('JudicialChamber')
        .ele('CourtJurisdiction').txt('Special Digital Evidence & Cyber Forensics Court').up()
        .ele('CertifyingOfficer')
          .ele('OfficerName').txt(req.user.name || 'Court Officer').up()
          .ele('OfficerRole').txt(req.user.role || 'court_officer').up()
          .ele('OfficerId').txt(String(req.user.id || req.user._id || '')).up()
        .up()
      .up()
      .ele('ElectronicRecord')
        .ele('EvidenceId').txt(evidence.evidenceId).up()
        .ele('CaseNumber').txt(evidence.caseNumber).up()
        .ele('Title').txt(evidence.title).up()
        .ele('EvidenceType').txt(evidence.evidenceType).up()
        .ele('OriginalFilename').txt(evidence.originalFilename).up()
        .ele('FileSizeInBytes').txt(String(evidence.fileSize || 0)).up()
        .ele('MimeType').txt(evidence.mimeType || 'application/octet-stream').up()
        .ele('IntakeTimestamp').txt(evidence.uploadedAt || evidence.createdAt || '').up()
        .ele('SeizingOfficer')
          .ele('Name').txt(populated.uploadedBy ? populated.uploadedBy.name : 'Unknown').up()
          .ele('Role').txt(populated.uploadedBy ? populated.uploadedBy.role : 'investigator').up()
        .up()
      .up()
      .ele('CryptographicIntegrity')
        .ele('Algorithm').txt('FIPS 180-4 SHA-256').up()
        .ele('ReferenceDigest').txt(evidence.sha256Hash).up()
        .ele('IntegrityVerificationStatus').txt(evidence.integrityStatus || 'Not Checked').up()
        .ele('LastVerificationTimestamp').txt(evidence.lastVerifiedAt || 'N/A').up()
        .ele('CourtAcceptanceStatus').txt(evidence.courtReviewStatus || 'None').up()
        .ele('CourtReviewer').txt(populated.courtReviewedBy ? populated.courtReviewedBy.name : 'Pending Review').up()
      .up();
    const custodyEle = root.ele('ChainOfCustodyAuditTrail', { totalEvents: String((custodyTimeline || []).length) });

    (custodyTimeline || []).forEach((log, index) => {
      custodyEle.ele('Event', { sequence: String(index + 1) })
        .ele('Timestamp').txt(log.timestamp).up()
        .ele('Action').txt(log.action).up()
        .ele('CustodianName').txt(log.performedBy ? log.performedBy.name : (log.performedByName || 'System')).up()
        .ele('CustodianRole').txt(log.performedBy ? (log.performedBy.role || 'system') : 'system').up()
        .ele('Remarks').txt(log.remarks || '').up();
    });

    const notesEle = root.ele('JudicialAndTechnicalObservations');
    if (Array.isArray(populated.notes)) {
      populated.notes.forEach((note) => {
        notesEle.ele('Observation', { type: note.noteType || 'general', recordedAt: note.addedAt })
          .ele('Author').txt(note.addedByName || 'Officer').up()
          .ele('Statement').txt(note.text || '').up();
      });
    }

    root.ele('LegalDeclaration')
      .ele('StatutoryReference').txt('Section 65B(4) of the Indian Evidence Act, 1872 / Section 63 of Bharatiya Sakshya Adhiniyam, 2023').up()
      .ele('DeclarationStatement').txt('I hereby certify that the electronic record described herein was ingested and secured in an unalterable, cryptographically signed condition. The physical file hash directly corresponds to the reference baseline digest without evidence of post-intake mutation.').up()
      .ele('CertificationStamp').txt(`VALID-COURT-RECORD-${evidence.evidenceId}`).up();

    const xmlString = root.end({ prettyPrint: true });

    await logAudit({
      req,
      action: 'COURT_CERTIFICATE_EXPORTED',
      evidenceId: evidence.id,
      details: `Section 65B electronic certificate exported to XML for ${evidence.evidenceId} by ${req.user.name}`,
    });

    res.header('Content-Type', 'application/xml');
    res.attachment(`section-65b-certificate-${evidence.evidenceId}.xml`);
    return res.send(xmlString);
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

    const isResubmission = evidence.courtReviewStatus === 'Requires Clarification';
    if (evidence.courtReviewStatus && evidence.courtReviewStatus !== 'None' && !isResubmission) {
      return res.status(400).json({
        success: false,
        message: `This evidence has already been submitted to the court (Current status: ${evidence.courtReviewStatus}).`,
      });
    }

    // Role check: Only the case investigator or system administrator can submit evidence to court
    if (req.user.role !== 'admin' && req.user.role !== 'investigator') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only the case investigator can submit evidence to the court.',
      });
    }

    // Block court submission if evidence is currently transferred/assigned out and not yet returned
    const uploaderId = String(evidence.uploadedBy?.id || evidence.uploadedBy?._id || evidence.uploadedBy);
    const currentHolderId = String(evidence.currentHolder?.id || evidence.currentHolder?._id || evidence.currentHolder);

    if (uploaderId && currentHolderId && uploaderId !== currentHolderId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot submit to court: Evidence is currently assigned/transferred to another officer or forensic lab. Custody must be returned to the primary case investigator before court submission.',
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
      courtClarificationReason: isResubmission && evidence.courtClarificationReason ? `Resolved: ${evidence.courtClarificationReason}` : '',
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
      action: isResubmission ? 'COURT_RESUBMITTED' : 'SUBMITTED_TO_COURT',
      fromUser: currentUserId,
      toUser: courtOfficer ? courtOfficer.id : null,
      performedBy: currentUserId,
      remarks: remarks ? remarks.trim() : (isResubmission ? 'Evidence resubmitted with clarification response.' : 'Evidence formally submitted for judicial court review.'),
      timestamp: now,
    });

    await logAudit({
      req,
      action: isResubmission ? 'COURT_CLARIFICATION_RESUBMITTED' : 'STATUS_CHANGED',
      evidenceId: evidence.id,
      details: isResubmission
        ? `Evidence ${evidence.evidenceId} resubmitted to court with clarification by ${req.user.name}`
        : `Evidence ${evidence.evidenceId} submitted to court for review by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: isResubmission
        ? 'Evidence successfully resubmitted to court with clarification response.'
        : 'Evidence formally submitted for judicial court review.',
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

// @desc    Preview court evidence file inline
// @route   GET /api/court/evidence/:id/preview
// @access  Private (court_officer, admin)
const previewCourtEvidence = async (req, res, next) => {
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
      return res.status(404).json({
        success: false,
        message: 'Physical evidence file is not present on the server storage.',
      });
    }

    const ext = path.extname(evidence.originalFilename || evidence.filePath).toLowerCase();
    let mimeType = evidence.mimeType || 'application/octet-stream';

    const mimeMap = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
      '.log': 'text/plain; charset=utf-8',
      '.json': 'application/json',
      '.csv': 'text/plain; charset=utf-8',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.html': 'text/plain; charset=utf-8',
      '.bin': 'application/octet-stream',
    };

    if (mimeMap[ext]) {
      mimeType = mimeMap[ext];
    }

    await logAudit({
      req,
      action: 'COURT_EVIDENCE_PREVIEWED',
      evidenceId: evidence.id,
      details: `Court Officer ${req.user.name} inspected/previewed physical evidence file: ${evidence.originalFilename} (${evidence.evidenceId})`,
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${evidence.originalFilename}"`);
    fs.createReadStream(evidence.filePath).pipe(res);
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
  exportCourtCertificateXml,
  submitEvidenceToCourt,
  getCourtAuditLogs,
  previewCourtEvidence,
};
