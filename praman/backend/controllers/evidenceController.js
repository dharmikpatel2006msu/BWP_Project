const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const CustodyLog = require('../models/CustodyLog');
const { calculateFileHash } = require('../utils/hashFile');
const { generateEvidenceId } = require('../utils/generateEvidenceId');
const { logAudit } = require('../utils/auditLogger');

// Helper to find evidence by _id or evidenceId
const findEvidenceByIdOrCode = async (idParam) => {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    return await Evidence.findById(idParam);
  }
  return await Evidence.findOne({ evidenceId: idParam });
};

// @desc    Upload new digital evidence
// @route   POST /api/evidence
// @access  Private (Admin, Investigator)
const uploadEvidence = async (req, res, next) => {
  try {
    const { title, caseNumber, description, evidenceType, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No evidence file uploaded. Please select a valid file.',
      });
    }

    if (!title || !caseNumber) {
      // Clean up uploaded file if validation fails
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Please provide both evidence title and case number.',
      });
    }

    // Step 1: Calculate SHA-256 hash using streaming
    const sha256Hash = await calculateFileHash(req.file.path);

    // Step 2: Generate unique human-readable Evidence ID (EV-YYYY-XXXX)
    const evidenceId = await generateEvidenceId();

    // Step 3: Create initial notes array if provided
    const initialNotes = [];
    if (notes && notes.trim()) {
      initialNotes.push({
        text: notes.trim(),
        addedBy: req.user._id,
        addedByName: req.user.name,
        addedAt: new Date(),
      });
    }

    // Step 4: Create Evidence record
    const evidence = await Evidence.create({
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
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
      currentHolder: req.user._id,
      status: 'Uploaded',
      notes: initialNotes,
      integrityStatus: 'Not Checked',
    });

    // Step 5: Append to Chain of Custody (Initial upload record)
    await CustodyLog.create({
      evidence: evidence._id,
      action: 'UPLOADED',
      fromUser: null,
      toUser: req.user._id,
      performedBy: req.user._id,
      remarks: `Initial evidence ingestion. Generated SHA-256: ${sha256Hash}`,
      timestamp: new Date(),
    });

    // Step 6: Create Audit Log
    await logAudit({
      req,
      action: 'EVIDENCE_UPLOADED',
      evidenceId: evidence._id,
      details: `Evidence ${evidence.evidenceId} uploaded by ${req.user.name} (${req.user.role}) for Case #${evidence.caseNumber}`,
    });

    // Populate user details before returning
    const populated = await Evidence.findById(evidence._id)
      .populate('uploadedBy', 'name email role')
      .populate('currentHolder', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Evidence uploaded successfully and initial SHA-256 hash generated.',
      data: populated,
    });
  } catch (err) {
    // Clean up uploaded file if an error occurs
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

    const query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by evidence type
    if (type) {
      query.evidenceType = type;
    }

    // Filter by case number
    if (caseNumber) {
      query.caseNumber = { $regex: caseNumber.trim(), $options: 'i' };
    }

    // Search query matching title, evidenceId, caseNumber, or description
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
      .sort({ createdAt: -1 })
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

    const populated = await Evidence.findById(evidence._id)
      .populate('uploadedBy', 'name email role')
      .populate('currentHolder', 'name email role')
      .populate('notes.addedBy', 'name email role');

    // Audit log evidence viewing
    await logAudit({
      req,
      action: 'EVIDENCE_VIEWED',
      evidenceId: evidence._id,
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

    // Check if the physical file exists on the server
    if (!fs.existsSync(evidence.filePath)) {
      evidence.integrityStatus = 'Failed';
      evidence.lastVerifiedAt = new Date();
      await evidence.save();

      await CustodyLog.create({
        evidence: evidence._id,
        action: 'VERIFIED',
        performedBy: req.user._id,
        remarks: 'CRITICAL INTEGRITY FAILURE: Physical evidence file missing from disk!',
        timestamp: new Date(),
      });

      await logAudit({
        req,
        action: 'EVIDENCE_VERIFIED',
        evidenceId: evidence._id,
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
          lastVerifiedAt: evidence.lastVerifiedAt,
          error: 'File not found on filesystem',
        },
      });
    }

    // Step 1: Compute current SHA-256 hash from disk
    const currentHash = await calculateFileHash(evidence.filePath);

    // Step 2: Compare with reference sha256Hash (NEVER OVERWRITE original sha256Hash!)
    const isMatch = currentHash.toLowerCase() === evidence.sha256Hash.toLowerCase();
    const newIntegrityStatus = isMatch ? 'Verified' : 'Failed';

    evidence.integrityStatus = newIntegrityStatus;
    evidence.lastVerifiedAt = new Date();
    if (isMatch && evidence.status === 'Uploaded') {
      evidence.status = 'Verified';
    }
    await evidence.save();

    // Step 3: Append to Chain of Custody
    await CustodyLog.create({
      evidence: evidence._id,
      action: 'VERIFIED',
      performedBy: req.user._id,
      remarks: isMatch
        ? `Integrity check PASSED. Computed SHA-256 matches reference hash: ${currentHash.substring(0, 16)}...`
        : `CRITICAL INTEGRITY FAILURE. Hash mismatch! Original: ${evidence.sha256Hash.substring(0, 16)}..., Current: ${currentHash.substring(0, 16)}...`,
      timestamp: new Date(),
    });

    // Step 4: Audit log
    await logAudit({
      req,
      action: 'EVIDENCE_VERIFIED',
      evidenceId: evidence._id,
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
        lastVerifiedAt: evidence.lastVerifiedAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add forensic note to evidence
// @route   POST /api/evidence/:id/notes
// @access  Private
const addEvidenceNote = async (req, res, next) => {
  try {
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

    const newNote = {
      text: text.trim(),
      addedBy: req.user._id,
      addedByName: req.user.name,
      addedAt: new Date(),
    };

    evidence.notes.push(newNote);
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'NOTE_ADDED',
      performedBy: req.user._id,
      remarks: `Note added: "${text.trim().substring(0, 60)}${text.trim().length > 60 ? '...' : ''}"`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence._id,
      details: `Note appended to ${evidence.evidenceId} by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: 'Note added successfully.',
      data: evidence.notes,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update evidence status (Under Review, Assigned, Verified, Archived)
// @route   PATCH /api/evidence/:id/status
// @access  Private (Admin, Forensic Officer)
const updateEvidenceStatus = async (req, res, next) => {
  try {
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

    const previousStatus = evidence.status;
    evidence.status = status;
    await evidence.save();

    await CustodyLog.create({
      evidence: evidence._id,
      action: 'STATUS_CHANGED',
      performedBy: req.user._id,
      remarks: `Status updated from '${previousStatus}' to '${status}'`,
      timestamp: new Date(),
    });

    await logAudit({
      req,
      action: 'STATUS_CHANGED',
      evidenceId: evidence._id,
      details: `Status of ${evidence.evidenceId} changed from ${previousStatus} to ${status} by ${req.user.name}`,
    });

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}.`,
      data: evidence,
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

module.exports = {
  uploadEvidence,
  getEvidenceList,
  getEvidenceById,
  verifyEvidence,
  addEvidenceNote,
  updateEvidenceStatus,
  downloadEvidence,
};
