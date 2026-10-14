/**
 * P.R.A.M.A.N — Court Evidence Review Report Controller
 *
 * @rule COURT_OFFICER_ONLY
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const urlParams = new URLSearchParams(window.location.search);
  const evidenceId = urlParams.get('id');
  const selector = document.getElementById('select-report-evidence');

  // Populate exhibit options for instant report generation
  try {
    const listRes = await api.get('/court/evidence?limit=100');
    if (listRes && listRes.data && listRes.data.length > 0) {
      if (selector) {
        selector.innerHTML = listRes.data
          .map((ev) => `<option value="${ev._id}" ${(evidenceId === ev._id || (!evidenceId && ev === listRes.data[0])) ? 'selected' : ''}>${ev.evidenceId} - ${escapeHtml(ev.title)} (${escapeHtml(ev.caseNumber)})</option>`)
          .join('');

        selector.addEventListener('change', () => {
          if (selector.value) {
            loadReportForId(selector.value);
          }
        });
      }

      const activeId = evidenceId || listRes.data[0]._id;
      await loadReportForId(activeId);
    } else {
      if (selector) selector.innerHTML = '<option value="">No court exhibits available</option>';
      showToast('No court exhibits submitted yet.', 'info');
    }
  } catch (err) {
    showToast(`Failed to load court evidence list: ${err.message}`, 'error');
  }

  const printBtn = document.getElementById('btn-print-report');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
});

async function loadReportForId(id) {
  try {
    const res = await api.get(`/court/evidence/${id}/report`);
    if (!res || !res.data) return;
    renderReport(res.data);
  } catch (err) {
    showToast(`Failed to generate report: ${err.message}`, 'error');
  }
}

function renderReport(data) {
  const { evidence, custodyTimeline, notesBreakdown, generatedAt, generatedBy } = data;

  document.getElementById('rep-evidence-id').textContent = evidence.evidenceId;
  document.getElementById('rep-case-number').textContent = evidence.caseNumber;
  document.getElementById('rep-title').textContent = evidence.title;
  document.getElementById('rep-type').textContent = evidence.evidenceType;
  document.getElementById('rep-filename').textContent = evidence.originalFilename;
  document.getElementById('rep-filesize').textContent = formatFileSize(evidence.fileSize);
  document.getElementById('rep-uploaded-by').textContent = evidence.uploadedBy ? `${evidence.uploadedBy.name} (${evidence.uploadedBy.role})` : 'System';
  document.getElementById('rep-uploaded-at').textContent = formatDate(evidence.uploadedAt || evidence.createdAt);

  document.getElementById('rep-orig-hash').textContent = evidence.sha256Hash;
  document.getElementById('rep-integrity-result').textContent = evidence.integrityStatus || 'Not Checked';
  document.getElementById('rep-last-verified').textContent = evidence.lastVerifiedAt ? formatDate(evidence.lastVerifiedAt) : 'Not verified';

  document.getElementById('rep-court-status').textContent = evidence.courtReviewStatus || 'None';
  document.getElementById('rep-forensic-status').textContent = evidence.status || 'Verified';
  document.getElementById('rep-reviewed-by').textContent = evidence.courtReviewedBy ? `${evidence.courtReviewedBy.name} (${evidence.courtReviewedBy.role})` : 'Not yet formally reviewed';
  document.getElementById('rep-reviewed-at').textContent = evidence.courtReviewedAt ? formatDate(evidence.courtReviewedAt) : 'Pending';

  document.getElementById('rep-generated-at').textContent = formatDate(generatedAt);
  document.getElementById('rep-generated-by').textContent = `${generatedBy.name} (${generatedBy.role.replace('_', ' ').toUpperCase()})`;

  // Chain of Custody Summary
  const custodyList = document.getElementById('rep-custody-summary');
  if (custodyList && custodyTimeline) {
    custodyList.innerHTML = custodyTimeline
      .map(
        (c) => `
        <li style="padding: 6px 0; border-bottom: 1px dotted var(--border);">
          <strong>${c.action}</strong> • ${formatDate(c.timestamp)} — 
          <span>${escapeHtml(c.remarks || 'No remarks recorded')}</span>
          <span style="color: var(--text-secondary); font-size: 11px;">(By: ${escapeHtml(c.performedByName || 'Officer')})</span>
        </li>
      `
      )
      .join('');
  }

  // Notes Breakdown
  const notesContainer = document.getElementById('rep-notes-summary');
  if (notesContainer) {
    const allNotes = [
      ...(notesBreakdown.investigator || []),
      ...(notesBreakdown.forensic || []),
      ...(notesBreakdown.court || []),
      ...(notesBreakdown.other || []),
    ];

    if (allNotes.length === 0) {
      notesContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 12px;">No technical or judicial observations entered.</p>';
    } else {
      notesContainer.innerHTML = allNotes
        .map(
          (n) => `
          <div style="background: var(--surface); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 6px; font-size: 12px;">
            <strong>[${(n.noteType || 'General').toUpperCase()}]</strong> ${escapeHtml(n.text)}
            <span style="display: block; font-size: 10.5px; color: var(--text-secondary); margin-top: 2px;">Entered by ${escapeHtml(n.addedByName || 'Officer')} • ${formatDate(n.addedAt)}</span>
          </div>
        `
        )
        .join('');
    }
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
