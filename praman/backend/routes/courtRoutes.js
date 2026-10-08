/**
 * P.R.A.M.A.N — Court Officer Routes
 *
 * @rule COURT_OFFICER_ONLY
 */

const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/courtController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Submission endpoint (Investigator, Forensic, Admin submit evidence to court)
router.post('/submit/:id', protect, authorize('admin', 'investigator', 'forensic'), submitEvidenceToCourt);

// Court Officer routes (Protected & Authorized for court_officer and admin)
router.get('/stats', protect, authorize('court_officer', 'admin'), getCourtDashboardStats);
router.get('/evidence', protect, authorize('court_officer', 'admin'), getCourtEvidenceList);
router.get('/evidence/:id', protect, authorize('court_officer', 'admin'), getCourtEvidenceById);
router.post('/evidence/:id/verify', protect, authorize('court_officer', 'admin'), verifyCourtEvidence);
router.post('/evidence/:id/notes', protect, authorize('court_officer', 'admin'), addCourtNote);
router.post('/evidence/:id/accept', protect, authorize('court_officer', 'admin'), acceptForCourtRecord);
router.post('/evidence/:id/clarification', protect, authorize('court_officer', 'admin'), requestClarification);
router.post('/evidence/:id/start-review', protect, authorize('court_officer', 'admin'), startCourtReview);
router.get('/evidence/:id/report', protect, authorize('court_officer', 'admin'), getCourtEvidenceReport);
router.get('/audit', protect, authorize('court_officer', 'admin'), getCourtAuditLogs);

module.exports = router;
