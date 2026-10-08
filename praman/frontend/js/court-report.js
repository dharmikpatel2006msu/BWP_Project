/**
 * P.R.A.M.A.N — Court Evidence Review Report Controller
 *
 * @rule COURT_OFFICER_ONLY
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const urlParams = new URLSearchParams(window.location.search);
  const evidenceId = urlParams.get('id');

  if (!evidenceId) {
    showToast('No evidence specified for report. Redirecting to court catalog...', 'warning');
    setTimeout(() => (window.location.href = 'court-evidence.html'), 1200);
    return;
  }

  try {
    const res = await api.get(`/court/evidence/${evidenceId}/report`);
    if (!res || !res.data) return;

    renderReport(res.data);
  } catch (err) {
    showToast(`Failed to generate report: ${err.message}`, 'error');
  }

  const printBtn = document.getElementById('btn-print-report');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
});

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
  const timelineTbody = document.getElementById('rep-timeline-tbody');
  if (timelineTbody) {
    if (custodyTimeline.length === 0) {
      timelineTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No custody records logged.</td></tr>';
    } else {
      timelineTbody.innerHTML = custodyTimeline
        .map(
          (c, idx) => `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td class="mono">${formatDate(c.timestamp)}</td>
            <td><strong>${c.action}</strong></td>
            <td>${escapeHtml(c.performedBy?.name || 'Officer')}</td>
            <td>${escapeHtml(c.remarks || '')}</td>
          </tr>
        `
        )
        .join('');
    }
  }

  // Court Notes
  const courtNotesContainer = document.getElementById('rep-court-notes');
  if (courtNotesContainer) {
    const courtNotes = notesBreakdown.courtNotes || [];
    if (courtNotes.length === 0) {
      courtNotesContainer.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No judicial court review notes logged.</p>';
    } else {
      courtNotesContainer.innerHTML = courtNotes
        .map(
          (n) => `
          <div style="margin-bottom: 8px; padding: 8px 12px; background: #fbfbfc; border-left: 3px solid #f59e0b;">
            <p style="font-size: 13px; margin-bottom: 2px;">${escapeHtml(n.text)}</p>
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(n.addedByName || 'Court Officer')} • ${formatDate(n.addedAt)}</span>
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
