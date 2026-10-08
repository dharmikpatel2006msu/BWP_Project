const mongoose = require('mongoose');

const custodyLogSchema = new mongoose.Schema({
  evidence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Evidence',
    required: true,
  },
  action: {
    type: String,
    enum: [
      'UPLOADED',
      'ASSIGNED',
      'TRANSFERRED',
      'VERIFIED',
      'STATUS_CHANGED',
      'NOTE_ADDED',
      'SUBMITTED_TO_COURT',
      'COURT_REVIEWED',
      'COURT_ACCEPTED',
      'CLARIFICATION_REQUESTED',
    ],
    required: true,
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  remarks: {
    type: String,
    trim: true,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

custodyLogSchema.index({ evidence: 1, timestamp: -1 });

module.exports = mongoose.model('CustodyLog', custodyLogSchema);
