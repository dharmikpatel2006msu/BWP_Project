const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { supabase } = require('../config/db');
const { calculateFileHash } = require('../utils/hashFile');
const { generateEvidenceId } = require('../utils/generateEvidenceId');
const { logAudit } = require('../utils/auditLogger');
const { formatRecord, populateUsers } = require('../utils/populateHelper');

// Helper to find evidence by id or evidenceId
const findEvidenceByIdOrCode = async (idParam) => {
  const { data } = await supabase
    .from('evidence')
    .select('*')
    .or(`id.eq.${idParam},evidenceId.eq.${idParam}`)
    .maybeSingle();

  return data ? formatRecord(data) : null;
};

// @desc    Upload new digital evidence
// @route   POST /api/evidence
// @access  Private (Investigator ONLY)
const uploadEvidence = async (req, res, next) => {
  try {
    // Strict Limitation: System Admin is an observer and CANNOT ingest evidence
    if (req.user.role === 'admin') {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: System Admin is an observer for governance and cannot upload evidence.',
      });
    }

    const { title, caseNumber, description, evidenceType, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No evidence file uploaded. Please select a valid file.',
      });
    }

    if (!title || !caseNumber) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Please provide both evidence title and case number.',
      });
    }

    // Category vs File extension restriction
    const ext = path.extname(req.file.originalname).toLowerCase();
    const categoryExtensions = {
      'Document': ['.pdf', '.txt', '.docx', '.doc', '.log', '.rtf', '.odt'],
      'Image': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'],
      'Audio': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
      'Video': ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'],
      'Disk Image': ['.dd', '.raw', '.img', '.iso', '.bin', '.vmdk', '.e01'],
      'Memory Dump': ['.dmp', '.dump', '.raw', '.bin', '.mem'],
      'Network Log': ['.pcap', '.pcapng', '.cap', '.log', '.txt'],
    };

    if (evidenceType && categoryExtensions[evidenceType]) {
      const allowed = categoryExtensions[evidenceType];
      if (!allowed.includes(ext)) {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: `Category Mismatch: Cannot upload a '${ext}' file under category '${evidenceType}'. Allowed formats: ${allowed.join(', ')}`,
        });
      }
    }

    const sha256Hash = await calculateFileHash(req.file.path);
    const evidenceId = await generateEvidenceId();
    const currentUserId = req.user.id || req.user._id;

    const initialNotes = [];
    if (notes && notes.trim()) {
      initialNotes.push({
        text: notes.trim(),
        addedBy: currentUserId,
        addedByName: req.user.name,
        addedAt: new Date().toISOString(),
      });
    }

    const newEvidenceId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: evidence, error } = await supabase
      .from('evidence')
      .insert({
        id: newEvidenceId,
        evidenceId,
        caseNumber: caseNumber.trim(),
        title: title.trim(),
        description: description ? description.trim() : '',
        evidenceType: evidenceType || 'Document',
        originalFilename: req.file.originalname,
        storedFilename: req.file.filename,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        sha256Hash,
        uploadedBy: currentUserId,
        uploadedAt: now,
        currentHolder: currentUserId,
        status: 'Uploaded',
        notes: initialNotes,
        integrityStatus: 'Not Checked',
        courtReviewStatus: 'None',
        courtClarificationReason: '',
        createdAt: now,
        updatedAt: now,
      })
      .select('*')
      .single();

    if (error || !evidence) {
      throw new Error(error ? error.message : 'Failed to insert evidence record');
    }

    const formattedEvidence = formatRecord(evidence);

    // Append to Chain of Custody
    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: formattedEvidence.id,
      action: 'UPLOADED',
      fromUser: null,
      toUser: currentUserId,
      performedBy: currentUserId,
      remarks: `Initial evidence ingestion. Generated SHA-256: ${sha256Hash}`,
      timestamp: now,
    });

    // Create Audit Log
    await logAudit({
      req,
      action: 'EVIDENCE_UPLOADED',
      evidenceId: formattedEvidence.id,
      details: `Evidence ${formattedEvidence.evidenceId} uploaded by ${req.user.name} (${req.user.role}) for Case #${formattedEvidence.caseNumber}`,
    });

    const populated = await populateUsers(formattedEvidence);

    res.status(201).json({
      success: true,
      message: 'Evidence uploaded successfully and initial SHA-256 hash generated.',
      data: populated,
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Error cleaning up file:', unlinkErr.message);
      }
    }
    next(err);
  }
};

// @desc    Get all evidence with search, filter, pagination
// @route   GET /api/evidence
// @access  Private
const getEvidenceList = async (req, res, next) => {
  try {
    const { search, status, type, caseNumber, page = 1, limit = 10 } = req.query;
    const currentUserId = req.user.id || req.user._id;

    let query = supabase.from('evidence').select('*', { count: 'exact' });

    // Localized Visibility ("Need-to-Know") for Forensic Expert:
    // Forensic experts ONLY see evidence items explicitly routed/assigned to them or held by them
    if (req.user.role === 'forensic') {
      query = query.or(`currentHolder.eq.${currentUserId},uploadedBy.eq.${currentUserId},courtAssignedTo.eq.${currentUserId}`);
    }

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('evidenceType', type);
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

    query = query.order('createdAt', { ascending: false }).range(skip, skip + limitNum - 1);

    const { data: evidenceList, count: total, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const populated = await populateUsers(evidenceList || []);

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

// @desc    Get single evidence by ID or evidenceId
// @route   GET /api/evidence/:id
// @access  Private
const getEvidenceById = async (req, res, next) => {
  try {
    const evidence = await findEvidenceByIdOrCode(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    // Need-to-Know check for Forensic Expert: must be assigned, current holder, or have participated in the custody chain
    const currentUserId = String(req.user.id || req.user._id);
    if (req.user.role === 'forensic') {
      const isHolder = evidence.currentHolder && String(evidence.currentHolder) === currentUserId;
      const isUploader = evidence.uploadedBy && String(evidence.uploadedBy) === currentUserId;
      const isAssigned = evidence.courtAssignedTo && String(evidence.courtAssignedTo) === currentUserId;

      let isAuthorized = isHolder || isUploader || isAssigned;
      if (!isAuthorized) {
        // Also permit forensic expert to inspect evidence they previously handled/returned in chain of custody
        const { count: logCount } = await supabase
          .from('custody_logs')
          .select('*', { count: 'exact', head: true })
          .eq('evidence', evidence.id)
          .or(`fromUser.eq.${currentUserId},toUser.eq.${currentUserId},performedBy.eq.${currentUserId}`);

        if (logCount && logCount > 0) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Forensic Expert workspace is restricted to assigned evidence cases only.',
        });
      }
    }

    const populated = await populateUsers(evidence);

    await logAudit({
      req,
      action: 'EVIDENCE_VIEWED',
      evidenceId: evidence.id,
      details: `Evidence ${evidence.evidenceId} viewed by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      data: populated,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Verify evidence integrity by recalculating SHA-256 hash
// @route   POST /api/evidence/:id/verify
// @access  Private
const verifyEvidence = async (req, res, next) => {
  try {
    const evidence = await findEvidenceByIdOrCode(req.params.id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence record not found.',
      });
    }

    const currentUserId = req.user.id || req.user._id;

    if (!fs.existsSync(evidence.filePath)) {
      const now = new Date().toISOString();
      await supabase
        .from('evidence')
        .update({ integrityStatus: 'Failed', lastVerifiedAt: now })
        .eq('id', evidence.id);

      await supabase.from('custody_logs').insert({
        id: crypto.randomUUID(),
        evidence: evidence.id,
        action: 'VERIFIED',
        performedBy: currentUserId,
        remarks: 'CRITICAL INTEGRITY FAILURE: Physical evidence file missing from disk!',
        timestamp: now,
      });

      await logAudit({
        req,
        action: 'EVIDENCE_VERIFIED',
        evidenceId: evidence.id,
        details: `Integrity check FAILED: Physical file missing for ${evidence.evidenceId}`,
      });

      return res.status(200).json({
        success: true,
        message: 'Integrity check completed: Stored file is missing from server storage.',
        data: {
          evidenceId: evidence.evidenceId,
          originalHash: evidence.sha256Hash,
          currentHash: null,
          integrityStatus: 'Failed',
          isMatch: false,
          lastVerifiedAt: now,
          error: 'File not found on filesystem',
        },
      });
    }

    const currentHash = await calculateFileHash(evidence.filePath);
    const isMatch = currentHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
    const newIntegrityStatus = isMatch ? 'Verified' : 'Failed';
    const now = new Date().toISOString();

    const updatePayload = {
      integrityStatus: newIntegrityStatus,
      lastVerifiedAt: now,
    };

    if (isMatch && evidence.status === 'Uploaded') {
      updatePayload.status = 'Verified';
    }

    await supabase.from('evidence').update(updatePayload).eq('id', evidence.id);

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'VERIFIED',
      performedBy: currentUserId,
      remarks: isMatch
        ? `Integrity check PASSED. Computed SHA-256 matches reference hash: ${currentHash.substring(0, 16)}...`
        : `CRITICAL INTEGRITY FAILURE. Hash mismatch! Original: ${evidence.sha256Hash.substring(0, 16)}..., Current: ${currentHash.substring(0, 16)}...`,
      timestamp: now,
    });

    await logAudit({
      req,
      action: 'EVIDENCE_VERIFIED',
      evidenceId: evidence.id,
      details: `Evidence ${evidence.evidenceId} verified by ${req.user.name}. Result: ${newIntegrityStatus} (Match: ${isMatch})`,
    });

    res.status(200).json({
      success: true,
      message: isMatch
        ? 'Verification successful: Evidence file integrity confirmed!'
        : 'INTEGRITY ALERT: File hash does not match original stored hash!',
      data: {
        evidenceId: evidence.evidenceId,
        originalHash: evidence.sha256Hash,
        currentHash,
        integrityStatus: newIntegrityStatus,
        isMatch,
        lastVerifiedAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add forensic note to evidence
// @route   POST /api/evidence/:id/notes
// @access  Private (Investigator, Forensic Expert)
const addEvidenceNote = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: System Admin is an observer for governance and cannot edit evidence files.',
      });
    }

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note text cannot be empty.',
      });
    }

    const evidence = await findEvidenceByIdOrCode(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    // Lock adding notes while evidence is under judicial court review or accepted into court record
    // Only activated when judge explicitly requests clarification
    if (evidence.courtReviewStatus && evidence.courtReviewStatus !== 'None' && evidence.courtReviewStatus !== 'Requires Clarification') {
      const msg = evidence.courtReviewStatus === 'Accepted for Court Record'
        ? 'Adding notes is prohibited: This evidence has been formally accepted into the official court record.'
        : `Adding notes is locked while evidence is under active judicial court review (${evidence.courtReviewStatus}).`;
      return res.status(400).json({
        success: false,
        message: msg,
      });
    }

    const currentUserId = req.user.id || req.user._id;

    const newNote = {
      text: text.trim(),
      addedBy: currentUserId,
      addedByName: req.user.name,
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
      remarks: `Technical analysis note added: "${text.trim().substring(0, 60)}${text.trim().length > 60 ? '...' : ''}"`,
      timestamp: new Date().toISOString(),
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence.id,
      details: `Technical note appended to ${evidence.evidenceId} by ${req.user.name} (${req.user.role})`,
    });

    res.status(200).json({
      success: true,
      message: 'Note added successfully.',
      data: updatedNotes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update evidence status (Under Review, Assigned, Verified, Archived)
// @route   PATCH /api/evidence/:id/status
// @access  Private (Forensic Officer)
const updateEvidenceStatus = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: System Admin is an observer for governance and cannot edit evidence status.',
      });
    }

    const { status } = req.body;
    const allowedStatuses = ['Uploaded', 'Under Review', 'Assigned', 'Verified', 'Archived'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const evidence = await findEvidenceByIdOrCode(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    const currentUserId = req.user.id || req.user._id;
    const previousStatus = evidence.status;

    const { data: updatedEvidence } = await supabase
      .from('evidence')
      .update({ status, updatedAt: new Date().toISOString() })
      .eq('id', evidence.id)
      .select('*')
      .single();

    await supabase.from('custody_logs').insert({
      id: crypto.randomUUID(),
      evidence: evidence.id,
      action: 'STATUS_CHANGED',
      performedBy: currentUserId,
      remarks: `Status updated from '${previousStatus}' to '${status}'`,
      timestamp: new Date().toISOString(),
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence.id,
      details: `Status of ${evidence.evidenceId} changed from ${previousStatus} to ${status} by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}.`,
      data: formatRecord(updatedEvidence || evidence),
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Download stored evidence file
// @route   GET /api/evidence/:id/download
// @access  Private
const downloadEvidence = async (req, res, next) => {
  try {
    // Strict Limitation: System Admin is an observer for governance and cannot download evidence files
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: System Admin is an observer for governance and cannot download evidence files.',
      });
    }

    const evidence = await findEvidenceByIdOrCode(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    if (!fs.existsSync(evidence.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Physical file is not present on the server storage.',
      });
    }

    res.download(evidence.filePath, evidence.originalFilename);
  } catch (err) {
    next(err);
  }
};

// @desc    Preview stored evidence file inline
// @route   GET /api/evidence/:id/preview
// @access  Private
const previewEvidence = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Strict Security Limitation: System Admin is an observer for governance and cannot preview evidence files.',
      });
    }

    const evidence = await findEvidenceByIdOrCode(req.params.id);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found.',
      });
    }

    if (!fs.existsSync(evidence.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Physical file is not present on the server storage.',
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

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${evidence.originalFilename}"`);
    fs.createReadStream(evidence.filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadEvidence,
  getEvidenceList,
  getEvidenceById,
  verifyEvidence,
  addEvidenceNote,
  updateEvidenceStatus,
  downloadEvidence,
  previewEvidence,
};
