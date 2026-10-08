const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'EVIDENCE_UPLOADED',
      'EVIDENCE_VIEWED',
      'EVIDENCE_VERIFIED',
      'EVIDENCE_TRANSFERRED',
      'STATUS_CHANGED',
      'USER_CREATED',
      'USER_DEACTIVATED',
      'USER_ACTIVATED',
      'XML_EXPORTED',
      'COURT_EVIDENCE_VIEWED',
      'COURT_EVIDENCE_VERIFIED',
      'COURT_REVIEW_STARTED',
      'COURT_REVIEW_ACCEPTED',
      'COURT_CLARIFICATION_REQUESTED',
      'COURT_NOTE_ADDED',
    ],
  },
  evidence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
  },
  details: {
    type: String,
    default: '',
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

auditLogSchema.index({ timestamp: -1, action: 1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ evidence: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
