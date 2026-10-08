const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  addedByName: {
    type: String,
  },
  noteType: {
    type: String,
    enum: ['investigator', 'forensic', 'court'],
    default: 'investigator',
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const evidenceSchema = new mongoose.Schema(
  {
    evidenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    caseNumber: {
      type: String,
      required: [true, 'Please provide a case number'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide an evidence title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    evidenceType: {
      type: String,
      required: true,
      enum: ['Document', 'Image', 'Audio', 'Video', 'Disk Image', 'Memory Dump', 'Network Log', 'Other'],
      default: 'Document',
    },
    originalFilename: {
      type: String,
      required: true,
    },
    storedFilename: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
      length: 64,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    currentHolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Uploaded', 'Under Review', 'Assigned', 'Verified', 'Archived'],
      default: 'Uploaded',
    },
    notes: [noteSchema],
    lastVerifiedAt: {
      type: Date,
    },
    integrityStatus: {
      type: String,
      enum: ['Not Checked', 'Verified', 'Failed'],
      default: 'Not Checked',
    },
    courtReviewStatus: {
      type: String,
      enum: [
        'None',
        'Pending Court Review',
        'Under Court Review',
        'Accepted for Court Record',
        'Requires Clarification',
        'Archived',
      ],
      default: 'None',
    },
    courtAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    courtClarificationReason: {
      type: String,
      default: '',
    },
    courtReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    courtReviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching and filtering
evidenceSchema.index({ evidenceId: 1, caseNumber: 1, status: 1, integrityStatus: 1 });
evidenceSchema.index({ title: 'text', description: 'text', caseNumber: 'text', evidenceId: 'text' });

module.exports = mongoose.model('Evidence', evidenceSchema);
