/**
 * P.R.A.M.A.N — Court Officer Dashboard Logic
 *
 * @rule COURT_OFFICER_ONLY
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const casesEl = document.getElementById('stat-court-cases');
  const submittedEl = document.getElementById('stat-court-submitted');
  const verifiedEl = document.getElementById('stat-court-verified');
  const pendingEl = document.getElementById('stat-court-pending');
  const acceptedEl = document.getElementById('stat-court-accepted');
  const clarificationEl = document.getElementById('stat-court-clarification');
  const courtEvidenceTbody = document.getElementById('court-recent-tbody');
  const courtActivityList = document.getElementById('court-activity-list');

  try {
    const res = await api.get('/court/stats');
    if (!res || !res.data) return;

    const {
      totalCourtCases,
      submittedToCourt,
      verifiedEvidence,
      pendingCourtReview,
      acceptedEvidence,
      requiresClarification,
      recentEvidence,
      recentActivity,
    } = res.data;

    // Stat counters
    if (casesEl) casesEl.textContent = totalCourtCases;
    if (submittedEl) submittedEl.textContent = submittedToCourt;
    if (verifiedEl) verifiedEl.textContent = verifiedEvidence;
    if (pendingEl) pendingEl.textContent = pendingCourtReview;
    if (acceptedEl) acceptedEl.textContent = acceptedEvidence;
    if (clarificationEl) clarificationEl.textContent = requiresClarification;

    // Render Recent Court Evidence Table
    if (courtEvidenceTbody) {
      if (recentEvidence.length === 0) {
        courtEvidenceTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">No evidence currently assigned or submitted for judicial court review.</td></tr>`;
      } else {
        courtEvidenceTbody.innerHTML = recentEvidence
          .map((ev) => {
            const integrityBadge =
              ev.integrityStatus === 'Verified'
                ? '<span class="badge badge-success">Verified</span>'
                : ev.integrityStatus === 'Failed'
                ? '<span class="badge badge-danger">Failed</span>'
                : '<span class="badge badge-warning">Not Checked</span>';

            const courtStatusBadge = getCourtStatusBadge(ev.courtReviewStatus);

            return `
              <tr class="clickable-row" onclick="window.location.href='court-review.html?id=${ev._id}'">
                <td class="mono" style="font-weight: 700; color: var(--accent);">${ev.evidenceId}</td>
                <td><span class="badge badge-secondary mono">${escapeHtml(ev.caseNumber)}</span></td>
                <td><strong>${escapeHtml(ev.title)}</strong></td>
                <td>${integrityBadge}</td>
                <td>${courtStatusBadge}</td>
                <td style="color: var(--text-secondary);">${formatDate(ev.updatedAt || ev.createdAt)}</td>
                <td>
                  <a href="court-review.html?id=${ev._id}" class="btn btn-primary btn-sm">Review</a>
                </td>
              </tr>
            `;
          })
          .join('');
      }
    }

    // Render Court Activity List
    if (courtActivityList && recentActivity) {
      if (recentActivity.length === 0) {
        courtActivityList.innerHTML = `
          <div style="text-align: center; padding: 32px 16px; color: var(--text-secondary);">
            <div style="margin-bottom: 8px; color: var(--text-secondary); opacity: 0.7;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            </div>
            <strong style="font-size: 13.5px; color: var(--text-primary); display: block; margin-bottom: 4px;">No Judicial Activity Yet</strong>
            <p style="font-size: 12px; line-height: 1.4;">Court reviews, verifications, and acceptance records will appear here as proceedings occur.</p>
          </div>
        `;
      } else {
        courtActivityList.innerHTML = recentActivity
          .map((act) => {
            const meta = formatCourtActivityItem(act);
            return `
              <li class="activity-feed-item">
                <div class="activity-icon-badge ${meta.iconBgClass}">
                  ${meta.icon}
                </div>
                <div class="activity-body">
                  <div class="activity-header">
                    <span class="activity-title">${escapeHtml(meta.title)}</span>
                    <span class="activity-time">${formatDate(act.timestamp)}</span>
                  </div>
                  <p class="activity-desc">${escapeHtml(act.details || 'Official judicial event recorded.')}</p>
                </div>
              </li>
            `;
          })
          .join('');
      }
    }
  } catch (err) {
    showToast(`Failed to load court dashboard metrics: ${err.message}`, 'error');
  }
});

function formatCourtActivityItem(act) {
  const action = (act.action || '').toUpperCase();
  if (action.includes('ACCEPT')) {
    return {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>',
      iconBgClass: 'activity-icon-green',
      title: 'Accepted for Court Record',
    };
  }
  if (action.includes('VERIFY')) {
    return {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
      iconBgClass: 'activity-icon-blue',
      title: 'Integrity Verified',
    };
  }
  if (action.includes('CLARIFICATION')) {
    return {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      iconBgClass: 'activity-icon-amber',
      title: 'Clarification Requested',
    };
  }
  if (action.includes('NOTE')) {
    return {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      iconBgClass: 'activity-icon-purple',
      title: 'Judicial Minute Recorded',
    };
  }
  if (action.includes('SUBMIT')) {
    return {
      icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
      iconBgClass: 'activity-icon-cyan',
      title: 'Submitted to Court',
    };
  }
  return {
    icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>',
    iconBgClass: 'activity-icon-slate',
    title: act.action ? act.action.replace('COURT_', '').replace(/_/g, ' ') : 'Judicial Proceeding',
  };
}

function getCourtStatusBadge(status) {
  switch (status) {
    case 'Accepted for Court Record':
      return '<span class="badge badge-success">Accepted for Record</span>';
    case 'Pending Court Review':
      return '<span class="badge badge-warning">Pending Review</span>';
    case 'Under Court Review':
      return '<span class="badge badge-info">Under Review</span>';
    case 'Requires Clarification':
      return '<span class="badge badge-danger">Clarification Needed</span>';
    case 'Archived':
      return '<span class="badge badge-secondary">Archived</span>';
    default:
      return '<span class="badge badge-secondary">None</span>';
  }
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
