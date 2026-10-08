const mongoose = require('mongoose');
const CustodyLog = require('../models/CustodyLog');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

// Helper to find evidence by _id or evidenceId
const findEvidence = async (idParam) => {
  if (mongoose.Types.ObjectId.isValid(idParam)) {
    return await Evidence.findById(idParam);
  }
  return await Evidence.findOne({ evidenceId: idParam });
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

    // Chronological order (oldest to newest) to show complete chain progression
    const logs = await CustodyLog.find({ evidence: evidence._id })
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('performedBy', 'name email role')
      .sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: {
        evidence: {
          _id: evidence._id,
          evidenceId: evidence.evidenceId,
          title: evidence.title,
          caseNumber: evidence.caseNumber,
          currentHolder: evidence.currentHolder,
          status: evidence.status,
          integrityStatus: evidence.integrityStatus,
        },
        timeline: logs,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Transfer evidence custody to another authorized user
// @route   POST /api/custody/transfer
// @access  Private (Admin, Investigator, currentHolder)
const transferEvidence = async (req, res, next) => {
  try {
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

    // Role check: Only admin, currentHolder, or investigator holding it can transfer
    const isCurrentHolder = evidence.currentHolder.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isCurrentHolder && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the current evidence custodian or an Administrator can initiate a transfer.',
      });
    }

    // Verify recipient user
    const recipientUser = await User.findById(toUserId);
    if (!recipientUser || !recipientUser.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Selected recipient user is invalid or currently deactivated.',
      });
    }

    if (recipientUser._id.toString() === evidence.currentHolder.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Evidence is already in custody of this user.',
      });
    }

    const previousHolderId = evidence.currentHolder;

    // Update evidence current holder and status
    evidence.currentHolder = recipientUser._id;
    if (evidence.status === 'Uploaded') {
      evidence.status = 'Assigned';
    }
    await evidence.save();

    // Create append-only chain of custody entry
    const custodyEntry = await CustodyLog.create({
      evidence: evidence._id,
      action: 'TRANSFERRED',
      fromUser: previousHolderId,
      toUser: recipientUser._id,
      performedBy: req.user._id,
      remarks: remarks ? remarks.trim() : `Transferred to ${recipientUser.name} (${recipientUser.role})`,
      timestamp: new Date(),
    });

    // Populate log entry
    const populatedLog = await CustodyLog.findById(custodyEntry._id)
      .populate('fromUser', 'name email role')
      .populate('toUser', 'name email role')
      .populate('performedBy', 'name email role');

    // Create Audit Log
    await logAudit({
      req,
      action: 'EVIDENCE_TRANSFERRED',
      evidenceId: evidence._id,
      details: `Custody of ${evidence.evidenceId} transferred from user to ${recipientUser.name} (${recipientUser.role})`,
    });

    res.status(200).json({
      success: true,
      message: `Evidence custody successfully transferred to ${recipientUser.name}.`,
      data: {
        evidence,
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
