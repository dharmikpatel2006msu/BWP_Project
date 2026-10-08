/**
 * P.R.A.M.A.N — Court Activity Audit Log Controller
 *
 * @rule COURT_OFFICER_ONLY
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const tbody = document.getElementById('court-activity-tbody');

  try {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-secondary);">Loading judicial review activity ledger...</td></tr>';

    const res = await api.get('/court/audit');
    if (!res || !res.data) return;

    const logs = res.data;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 28px; color: var(--text-secondary);">No judicial review events recorded yet.</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .map((log) => {
        const badgeClass = getActionBadgeClass(log.action);
        const evidenceCode = log.evidence
          ? `<span class="mono" style="color: var(--accent); font-weight: 600;">${log.evidence.evidenceId}</span>`
          : '<span style="color: var(--text-muted);">N/A</span>';
        const userDisplay = log.user ? `${escapeHtml(log.user.name)} (${log.user.role})` : 'System';

        return `
          <tr>
            <td><span class="badge ${badgeClass}">${log.action}</span></td>
            <td>${evidenceCode}</td>
            <td>${userDisplay}</td>
            <td style="font-size: 13px;">${escapeHtml(log.details || '')}</td>
            <td class="mono" style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${formatDate(log.timestamp)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    showToast(`Failed to load court activity logs: ${err.message}`, 'error');
  }
});

function getActionBadgeClass(action) {
  if (action.includes('ACCEPTED') || action.includes('VERIFIED')) {
    return 'badge-success';
  }
  if (action.includes('CLARIFICATION')) {
    return 'badge-danger';
  }
  if (action.includes('STARTED') || action.includes('NOTE')) {
    return 'badge-info';
  }
  return 'badge-secondary';
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
