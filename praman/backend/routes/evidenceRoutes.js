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

// List & Upload (Upload restricted strictly to Investigation Officer)
router
  .route('/')
  .get(protect, getEvidenceList)
  .post(protect, authorize('investigator'), upload.single('file'), uploadEvidence);

// Specific evidence details & download
router.get('/:id', protect, getEvidenceById);
router.get('/:id/download', protect, downloadEvidence);

// Verification (All evidence custodians / officers with access can verify integrity)
router.post('/:id/verify', protect, verifyEvidence);
router.get('/:id/verify', protect, verifyEvidence);

// Notes (Investigator & Forensic Expert notes)
router.post('/:id/notes', protect, authorize('investigator', 'forensic'), addEvidenceNote);

// Status update (Forensic Officer only)
router.patch('/:id/status', protect, authorize('forensic'), updateEvidenceStatus);

module.exports = router;
