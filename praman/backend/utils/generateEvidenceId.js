const { supabase } = require('../config/db');

/**
 * Automatically generates a sequential human-readable evidence ID.
 * Format: EV-<YYYY>-<0001> (e.g., EV-2026-0001)
 * @returns {Promise<string>} Next formatted evidence ID
 */
const generateEvidenceId = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `EV-${currentYear}-`;

  // Query the highest evidenceId for the current year
  const { data } = await supabase
    .from('evidence')
    .select('evidenceId')
    .ilike('evidenceId', `${prefix}%`)
    .order('evidenceId', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length > 0 && data[0].evidenceId) {
    const parts = data[0].evidenceId.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  }

  const paddedSeq = String(nextSeq).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
};

module.exports = { generateEvidenceId };
