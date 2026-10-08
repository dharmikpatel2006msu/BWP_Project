const express = require('express');
const router = express.Router();
const { getAuditLogs, exportAuditLogsXml } = require('../controllers/auditController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// XML export endpoint (Must come before /:id routes if any)
router.get('/export/xml', protect, authorize('admin'), exportAuditLogsXml);

// Audit logs list
router.get('/', protect, authorize('admin'), getAuditLogs);

module.exports = router;
