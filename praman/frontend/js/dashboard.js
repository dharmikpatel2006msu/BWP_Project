/**
 * P.R.A.M.A.N — Dynamic Role-Based Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  const user = getUser();
  if (!user) return;

  // Adapt Header and Top Bar Actions dynamically based on Role
  const titleEl = document.querySelector('.page-title-group h1');
  const subEl = document.querySelector('.page-title-group p');
  const actionContainer = document.querySelector('.top-bar-actions');
  const statLabel3 = document.querySelectorAll('.stat-label')[2];

  if (user.role === 'admin') {
    if (titleEl) titleEl.textContent = 'System Administration & Global Oversight';
    if (subEl) subEl.textContent = 'System access control, user provisioning, global evidence registry, and audit compliance';
    if (actionContainer) {
      actionContainer.innerHTML = `
        <a href="users.html" class="btn btn-primary btn-sm">
          <span>👥</span> User Management
        </a>
        <a href="audit.html" class="btn btn-secondary btn-sm" style="margin-left: 8px;">
          <span>📜</span> System Audit Logs
        </a>
      `;
    }
    if (statLabel3) statLabel3.textContent = 'Active Users';
  } else if (user.role === 'forensic') {
    if (titleEl) titleEl.textContent = 'Forensic Examination & Verification Lab';
    if (subEl) subEl.textContent = 'Secure evidence examination, SHA-256 cryptographic verification, and technical analysis notes';
    if (actionContainer) {
      actionContainer.innerHTML = `
        <a href="evidence.html" class="btn btn-primary btn-sm">
          <span>📁</span> Open Evidence Vault
        </a>
      `;
    }
    if (statLabel3) statLabel3.textContent = 'Pending Forensic Check';
  } else if (user.role === 'investigator') {
    if (titleEl) titleEl.textContent = 'Investigator Evidence Ingestion Hub';
    if (subEl) subEl.textContent = 'First-link chain of custody file ingestion and cryptographic SHA-256 baseline hashing';
    if (actionContainer) {
      actionContainer.innerHTML = `
        <a href="upload.html" class="btn btn-primary btn-sm">
          <span>+</span> Ingest Evidence
        </a>
      `;
    }
  }

  const totalEl = document.getElementById('stat-total');
  const verifiedEl = document.getElementById('stat-verified');
  const pendingEl = document.getElementById('stat-pending');
  const failedEl = document.getElementById('stat-failed');
  const recentTableBody = document.getElementById('recent-evidence-tbody');
  const recentActivityList = document.getElementById('recent-activity-list');
  const typeDistributionEl = document.getElementById('type-distribution');

  try {
    const res = await api.get('/dashboard/stats');
    if (!res || !res.data) return;

    const {
      totalEvidence,
      verifiedEvidence,
      pendingEvidence,
      failedIntegrity,
      totalUsers,
      evidenceByType,
      recentEvidence,
      recentActivity,
    } = res.data;

    // Set stat counters
    if (totalEl) totalEl.textContent = totalEvidence || 0;
    if (verifiedEl) verifiedEl.textContent = verifiedEvidence || 0;
    if (pendingEl) {
      pendingEl.textContent = user.role === 'admin' ? (totalUsers || 0) : (pendingEvidence || 0);
    }
    if (failedEl) failedEl.textContent = failedIntegrity || 0;

    // Render Recent Evidence Table
    if (recentTableBody) {
      if (!recentEvidence || recentEvidence.length === 0) {
        const uploadHint = (user.role === 'admin' || user.role === 'investigator') ? 'Click "+ Ingest Evidence" to add records.' : 'Waiting for evidence ingestion.';
        recentTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-secondary);">No evidence records found. ${uploadHint}</td></tr>`;
      } else {
        recentTableBody.innerHTML = recentEvidence
          .map((ev) => {
            const integrityBadge =
              ev.integrityStatus === 'Verified'
                ? '<span class="badge badge-success">Verified</span>'
                : ev.integrityStatus === 'Failed'
                ? '<span class="badge badge-danger">Failed</span>'
                : '<span class="badge badge-warning">Not Checked</span>';

            return `
              <tr class="clickable-row" onclick="window.location.href='evidence-details.html?id=${ev._id}'">
                <td class="mono" style="font-weight: 700; color: var(--accent);">${ev.evidenceId}</td>
                <td><strong>${escapeHtml(ev.title)}</strong></td>
                <td><span class="badge badge-secondary">${escapeHtml(ev.caseNumber)}</span></td>
                <td>${ev.evidenceType}</td>
                <td><span class="badge badge-info">${ev.status}</span></td>
                <td>${integrityBadge}</td>
                <td style="color: var(--text-secondary);">${formatDate(ev.createdAt)}</td>
              </tr>
            `;
          })
          .join('');
      }
    }

    // Render Type breakdown badges
    if (typeDistributionEl && evidenceByType) {
      const types = Object.keys(evidenceByType);
      if (types.length === 0) {
        typeDistributionEl.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">No evidence categories registered yet.</span>';
      } else {
        typeDistributionEl.innerHTML = types
          .map(
            (t) => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--surface); border-radius: var(--radius-sm); margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 600;">${t}</span>
              <span class="badge badge-info">${evidenceByType[t]} items</span>
            </div>
          `
          )
          .join('');
      }
    }

    // Render Recent Activity Stream
    if (recentActivityList && recentActivity) {
      if (recentActivity.length === 0) {
        recentActivityList.innerHTML = '<li style="color: var(--text-secondary); font-size: 13px; padding: 12px;">No activity logs recorded.</li>';
      } else {
        recentActivityList.innerHTML = recentActivity
          .map(
            (act) => `
            <li style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border);">
              <span class="mono" style="font-size: 11px; color: var(--accent); white-space: nowrap;">${formatDate(act.timestamp)}</span>
              <div style="flex: 1; font-size: 13px;">
                <strong>${act.action}</strong>
                <p style="color: var(--text-secondary); font-size: 12px; margin-top: 2px;">${escapeHtml(act.details || '')}</p>
              </div>
            </li>
          `
          )
          .join('');
      }
    }
  } catch (err) {
    showToast(`Failed to load dashboard metrics: ${err.message}`, 'error');
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
