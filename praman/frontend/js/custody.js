/**
 * P.R.A.M.A.N — Chain of Custody Timeline Controller
 */

let selectedEvidenceId = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  const user = getUser();
  const topActionBtn = document.querySelector('.top-bar-actions a');
  if (topActionBtn && user && user.role === 'court_officer') {
    topActionBtn.href = 'court-evidence.html';
    topActionBtn.textContent = 'Court Evidence Vault';
  }

  const urlParams = new URLSearchParams(window.location.search);
  const evidenceIdParam = urlParams.get('evidenceId');

  await populateEvidenceSelector(evidenceIdParam);

  const selectEl = document.getElementById('select-evidence');
  if (selectEl) {
    selectEl.addEventListener('change', () => {
      selectedEvidenceId = selectEl.value;
      if (selectedEvidenceId) {
        loadCustodyTimeline(selectedEvidenceId);
      }
    });
  }
});

async function populateEvidenceSelector(preselectedId) {
  const selectEl = document.getElementById('select-evidence');
  if (!selectEl) return;

  const user = getUser();
  const endpoint = user && user.role === 'court_officer' ? '/court/evidence?limit=100' : '/evidence?limit=100';

  try {
    const res = await api.get(endpoint);
    if (!res || !res.data) return;

    const evidenceItems = res.data;

    selectEl.innerHTML =
      '<option value="">-- Choose Evidence Item --</option>' +
      evidenceItems
        .map(
          (ev) =>
            `<option value="${ev._id}" ${preselectedId === ev._id ? 'selected' : ''}>${ev.evidenceId} - ${escapeHtml(
              ev.title
            )} (${escapeHtml(ev.caseNumber)})</option>`
        )
        .join('');

    if (preselectedId) {
      selectedEvidenceId = preselectedId;
      loadCustodyTimeline(preselectedId);
    } else if (evidenceItems.length > 0) {
      selectedEvidenceId = evidenceItems[0]._id;
      selectEl.value = selectedEvidenceId;
      loadCustodyTimeline(selectedEvidenceId);
    }
  } catch (err) {
    showToast(`Failed to load evidence choices: ${err.message}`, 'error');
  }
}

async function loadCustodyTimeline(evidenceId) {
  const container = document.getElementById('custody-timeline-container');
  const detailsHeader = document.getElementById('evidence-custody-header');
  const user = getUser();

  try {
    container.innerHTML = '<p style="padding: 20px; color: var(--text-secondary);">Loading chain of custody logs...</p>';

    const res = await api.get(`/custody/${evidenceId}`);
    if (!res || !res.data) return;

    const { evidence, timeline } = res.data;

    // Render evidence header bar
    if (detailsHeader) {
      const detailsLink =
        user && user.role === 'court_officer'
          ? `court-review.html?id=${evidence._id}`
          : `evidence-details.html?id=${evidence._id}`;

      detailsHeader.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="font-size: 17px; font-weight: 700; color: var(--text-primary);">
              <span class="mono" style="color: var(--accent);">${evidence.evidenceId}</span> : ${escapeHtml(evidence.title)}
            </h3>
            <span style="font-size: 12.5px; color: var(--text-secondary);">Case Number: <strong>${escapeHtml(evidence.caseNumber)}</strong></span>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="${detailsLink}" class="btn btn-secondary btn-sm">Full Dossier Details</a>
          </div>
        </div>
      `;
    }

    if (timeline.length === 0) {
      container.innerHTML = '<p style="padding: 24px; color: var(--text-secondary);">No custody records logged for this item.</p>';
      return;
    }

    // Build vertical timeline
    container.innerHTML = `
      <div class="timeline">
        ${timeline
          .map((item) => {
            const markerClass = getMarkerClass(item.action);
            const icon = getActionIcon(item.action);

            let metaText = `Logged by <strong>${escapeHtml(item.performedBy?.name || 'System')}</strong> (${item.performedBy?.role || ''})`;
            if (item.action === 'TRANSFERRED' && item.toUser) {
              metaText = `Transferred from <strong>${escapeHtml(item.fromUser?.name || 'Previous Custodian')}</strong> to <strong>${escapeHtml(item.toUser?.name || 'New Custodian')}</strong> (${item.toUser?.role || ''})`;
            }

            return `
              <div class="timeline-item">
                <div class="timeline-marker ${markerClass}">
                  ${icon}
                </div>
                <div class="timeline-card">
                  <div class="timeline-header">
                    <span class="timeline-action-title">${formatActionLabel(item.action)}</span>
                    <span class="timeline-time mono">${formatDate(item.timestamp)}</span>
                  </div>
                  <div class="timeline-meta">${metaText}</div>
                  ${
                    item.remarks
                      ? `<div class="timeline-remarks">${escapeHtml(item.remarks)}</div>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  } catch (err) {
    showToast(`Failed to load custody log: ${err.message}`, 'error');
  }
}

function getMarkerClass(action) {
  switch (action) {
    case 'UPLOADED':
      return 'marker-upload';
    case 'VERIFIED':
      return 'marker-verify';
    case 'TRANSFERRED':
      return 'marker-transfer';
    case 'STATUS_CHANGED':
      return 'marker-status';
    case 'NOTE_ADDED':
      return 'marker-note';
    case 'SUBMITTED_TO_COURT':
      return 'marker-transfer';
    case 'COURT_REVIEWED':
    case 'COURT_ACCEPTED':
      return 'marker-verify';
    default:
      return '';
  }
}

function getActionIcon(action) {
  switch (action) {
    case 'UPLOADED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    case 'VERIFIED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
    case 'TRANSFERRED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    case 'STATUS_CHANGED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>';
    case 'NOTE_ADDED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    case 'SUBMITTED_TO_COURT':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
    case 'COURT_REVIEWED':
    case 'COURT_ACCEPTED':
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>';
    default:
      return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/></svg>';
  }
}

function formatActionLabel(action) {
  switch (action) {
    case 'UPLOADED':
      return 'Evidence Ingestion & First Custody';
    case 'VERIFIED':
      return 'Cryptographic Integrity Check';
    case 'TRANSFERRED':
      return 'Custody Transfer';
    case 'STATUS_CHANGED':
      return 'Case Status Modification';
    case 'NOTE_ADDED':
      return 'Forensic Observation Appended';
    case 'SUBMITTED_TO_COURT':
      return 'Submitted for Judicial Court Review';
    case 'COURT_REVIEWED':
      return 'Court Officer Integrity Review';
    case 'COURT_ACCEPTED':
      return 'Accepted into Official Court Record';
    default:
      return action;
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
