const express = require('express');
const router = express.Router();
const { getCustodyLogsByEvidence, transferEvidence } = require('../controllers/custodyController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Get custody timeline for an evidence item
router.get('/:evidenceId', protect, getCustodyLogsByEvidence);

// Transfer evidence
router.post('/transfer', protect, authorize('admin', 'investigator', 'forensic'), transferEvidence);

module.exports = router;
