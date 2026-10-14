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
            <div style="font-size: 28px; margin-bottom: 8px; opacity: 0.8;">⚖️</div>
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
                    <span class="activity-time">🕒 ${formatDate(act.timestamp)}</span>
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
      icon: '✅',
      iconBgClass: 'activity-icon-green',
      title: 'Accepted for Court Record',
    };
  }
  if (action.includes('VERIFY')) {
    return {
      icon: '🛡️',
      iconBgClass: 'activity-icon-blue',
      title: 'Integrity Verified',
    };
  }
  if (action.includes('CLARIFICATION')) {
    return {
      icon: '❓',
      iconBgClass: 'activity-icon-amber',
      title: 'Clarification Requested',
    };
  }
  if (action.includes('NOTE')) {
    return {
      icon: '📝',
      iconBgClass: 'activity-icon-purple',
      title: 'Judicial Minute Recorded',
    };
  }
  if (action.includes('SUBMIT')) {
    return {
      icon: '📥',
      iconBgClass: 'activity-icon-cyan',
      title: 'Submitted to Court',
    };
  }
  return {
    icon: '⚖️',
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
