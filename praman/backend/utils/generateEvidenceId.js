const Evidence = require('../models/Evidence');

/**
 * Automatically generates a sequential human-readable evidence ID.
 * Format: EV-<YYYY>-<0001> (e.g., EV-2026-0001)
 * @returns {Promise<string>} Next formatted evidence ID
 */
const generateEvidenceId = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `EV-${currentYear}-`;

  // Find the highest sequence number for this year
  const regex = new RegExp(`^${prefix}(\\d{4})$`);
  const latestEvidence = await Evidence.findOne({ evidenceId: { $regex: regex } })
    .sort({ evidenceId: -1 })
    .lean();

  let nextSeq = 1;
  if (latestEvidence && latestEvidence.evidenceId) {
    const match = latestEvidence.evidenceId.match(regex);
    if (match && match[1]) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  const paddedSeq = String(nextSeq).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
};

module.exports = { generateEvidenceId };
