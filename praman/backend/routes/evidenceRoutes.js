const express = require('express');
const router = express.Router();
const {
  uploadEvidence,
  getEvidenceList,
  getEvidenceById,
  verifyEvidence,
  addEvidenceNote,
  updateEvidenceStatus,
  downloadEvidence,
} = require('../controllers/evidenceController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

// List & Upload
router
  .route('/')
  .get(protect, getEvidenceList)
  .post(protect, authorize('admin', 'investigator'), upload.single('file'), uploadEvidence);

// Specific evidence details & download
router.get('/:id', protect, getEvidenceById);
router.get('/:id/download', protect, downloadEvidence);

// Verification (All roles with access can verify integrity)
router.post('/:id/verify', protect, verifyEvidence);
router.get('/:id/verify', protect, verifyEvidence); // Also support GET as requested in spec

// Notes
router.post('/:id/notes', protect, addEvidenceNote);

// Status update (Admin, Forensic)
router.patch('/:id/status', protect, authorize('admin', 'forensic'), updateEvidenceStatus);

module.exports = router;
