/**
 * P.R.A.M.A.N — Court Evidence Review Report Controller
 * Certified Section 65B Admissibility & Forensic Audit Generator
 *
 * @rule COURT_OFFICER_ONLY
 */

let currentExhibitId = null;
let currentReportData = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const urlParams = new URLSearchParams(window.location.search);
  const requestedId = urlParams.get('id');
  const selector = document.getElementById('select-report-evidence');
  const printBtn = document.getElementById('btn-print-report');
  const exportXmlBtn = document.getElementById('btn-export-cert-xml');
  const exportJsonBtn = document.getElementById('btn-export-dossier-json');

  // Load court exhibits for dropdown
  try {
    const listRes = await api.get('/court/evidence?limit=100');
    const exhibits = listRes && listRes.data ? listRes.data : [];

    if (exhibits.length === 0) {
      showEmptyState(true);
      if (selector) selector.innerHTML = '<option value="">No court exhibits available</option>';
      return;
    }

    showEmptyState(false);

    if (selector) {
      selector.innerHTML = exhibits
        .map((ev) => {
          const id = ev._id || ev.id;
          const isSelected = requestedId === id || requestedId === ev.evidenceId;
          return `<option value="${id}" ${isSelected ? 'selected' : ''}>
            ${ev.evidenceId} — ${escapeHtml(ev.title)} [${escapeHtml(ev.caseNumber)}] (${ev.courtReviewStatus || 'Under Review'})
          </option>`;
        })
        .join('');

      // Determine initial active exhibit ID
      let initialId = exhibits[0]._id || exhibits[0].id;
      if (requestedId) {
        const found = exhibits.find((e) => (e._id || e.id) === requestedId || e.evidenceId === requestedId);
        if (found) initialId = found._id || found.id;
      }

      selector.value = initialId;
      await loadReportForId(initialId);

      selector.addEventListener('change', async () => {
        if (selector.value) {
          // Update URL without page reload
          const newUrl = new URL(window.location);
          newUrl.searchParams.set('id', selector.value);
          window.history.replaceState({}, '', newUrl);

          await loadReportForId(selector.value);
        }
      });
    }
  } catch (err) {
    showToast(`Failed to load court exhibits: ${err.message}`, 'error');
  }

  // Print / Save PDF
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // Export Section 65B XML
  if (exportXmlBtn) {
    exportXmlBtn.addEventListener('click', handleExportXml);
  }

  // Export JSON Dossier
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', handleExportJson);
  }
});

/**
 * Fetch and render report data for given exhibit ID
 */
async function loadReportForId(id) {
  if (!id) return;
  currentExhibitId = id;

  try {
    const res = await api.get(`/court/evidence/${id}/report`);
    if (!res || !res.data) {
      showToast('Could not load report dossier for this exhibit.', 'error');
      return;
    }

    currentReportData = res.data;
    renderReport(res.data);
  } catch (err) {
    showToast(`Failed to generate court report: ${err.message}`, 'error');
  }
}

/**
 * Render complete report sheet
 */
function renderReport(data) {
  const { evidence, custodyTimeline, notesBreakdown, generatedAt, generatedBy } = data;

  // 1. Identification & Metadata
  document.getElementById('rep-evidence-id').textContent = evidence.evidenceId || 'N/A';
  document.getElementById('rep-case-number').textContent = evidence.caseNumber || 'N/A';
  document.getElementById('rep-title').textContent = evidence.title || 'Untitled Evidence';
  document.getElementById('rep-type').textContent = evidence.evidenceType || 'General';
  document.getElementById('rep-filename').textContent = evidence.originalFilename || 'N/A';
  document.getElementById('rep-filesize').textContent = formatFileSize(evidence.fileSize);
  document.getElementById('rep-uploaded-by').textContent = evidence.uploadedBy ? `${evidence.uploadedBy.name} (${evidence.uploadedBy.role.toUpperCase()})` : 'System Intake';
  document.getElementById('rep-uploaded-at').textContent = formatDate(evidence.uploadedAt || evidence.createdAt);

  // 2. Cryptographic Integrity Audit
  document.getElementById('rep-orig-hash').textContent = evidence.sha256Hash || 'N/A';

  const integrityEl = document.getElementById('rep-integrity-result');
  if (integrityEl) {
    const status = evidence.integrityStatus || 'Not Checked';
    integrityEl.textContent = status;
    integrityEl.style.color = status === 'Verified' ? 'var(--success)' : status === 'Failed' ? 'var(--danger)' : 'var(--warning)';
  }

  document.getElementById('rep-last-verified').textContent = evidence.lastVerifiedAt ? formatDate(evidence.lastVerifiedAt) : 'Pending Verification';
  document.getElementById('rep-forensic-status').textContent = evidence.status || 'Active';
  document.getElementById('rep-court-status').textContent = evidence.courtReviewStatus || 'None';

  // 3. Dynamic Admissibility Stamp Seal
  renderCourtStamp(evidence);

  // 4. Judicial & Technical Observations
  renderNotesSection(notesBreakdown);

  // 5. Chain of Custody Table
  renderCustodyTimeline(custodyTimeline || []);

  // 6. Signatures & Attestation
  document.getElementById('rep-generated-at').textContent = formatDate(generatedAt || new Date().toISOString());
  document.getElementById('rep-generated-by').textContent = generatedBy ? `${generatedBy.name} (${(generatedBy.role || 'court_officer').toUpperCase()})` : 'Court Officer';
  document.getElementById('rep-reviewed-by').textContent = evidence.courtReviewedBy ? `${evidence.courtReviewedBy.name} (${(evidence.courtReviewedBy.role || 'court_officer').toUpperCase()})` : 'Pending Formal Examination';
  document.getElementById('rep-reviewed-at').textContent = evidence.courtReviewedAt ? formatDate(evidence.courtReviewedAt) : 'Pending';
}

/**
 * Render dynamic Judicial Stamp Seal
 */
function renderCourtStamp(evidence) {
  const container = document.getElementById('rep-stamp-container');
  if (!container) return;

  const courtStatus = evidence.courtReviewStatus;
  const integrityStatus = evidence.integrityStatus;

  if (courtStatus === 'Accepted for Court Record' && integrityStatus === 'Verified') {
    container.innerHTML = `
      <div class="court-stamp">
        <span>⚖️</span> CERTIFIED ADMISSIBLE RECORD — SECTION 65B INDIAN EVIDENCE ACT COMPLIANT
      </div>
    `;
  } else if (courtStatus === 'Requires Clarification') {
    container.innerHTML = `
      <div class="court-stamp court-stamp-danger">
        <span>⚠️</span> JUDICIAL EXAMINATION SUSPENDED — FORMAL CLARIFICATION REQUESTED
      </div>
    `;
  } else if (integrityStatus === 'Failed') {
    container.innerHTML = `
      <div class="court-stamp court-stamp-danger">
        <span>🚨</span> INTEGRITY VERIFICATION FAILED — TAMPERING ALERT
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="court-stamp court-stamp-info">
        <span>🔍</span> ACTIVE PROCEEDINGS — PENDING FORMAL JUDICIAL ACCEPTANCE
      </div>
    `;
  }
}

/**
 * Render observations and notes section
 */
function renderNotesSection(breakdown) {
  const container = document.getElementById('rep-court-notes');
  if (!container) return;

  const courtNotes = breakdown?.courtNotes || [];
  const forensicNotes = breakdown?.forensicNotes || [];
  const investigatorNotes = breakdown?.investigatorNotes || [];

  const all = [
    ...courtNotes.map((n) => ({ ...n, category: 'court', catLabel: '⚖️ Court Judicial Minute' })),
    ...forensicNotes.map((n) => ({ ...n, category: 'forensic', catLabel: '🔬 Forensic Laboratory Note' })),
    ...investigatorNotes.map((n) => ({ ...n, category: 'investigator', catLabel: '🕵️ Ingestion / Investigation Note' })),
  ];

  if (all.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px; font-style: italic; padding: 10px 0;">No technical or judicial observations recorded for this exhibit.</p>';
    return;
  }

  container.innerHTML = all
    .map(
      (n) => `
      <div class="report-note-card note-${n.category}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <strong style="font-size: 12px; color: var(--text-primary);">${escapeHtml(n.catLabel)}</strong>
          <span class="mono" style="font-size: 11px; color: var(--text-secondary);">${formatDate(n.addedAt)}</span>
        </div>
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-primary);">${escapeHtml(n.text || '')}</p>
        <span style="display: block; font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
          Recorded by: <strong>${escapeHtml(n.addedByName || 'Officer')}</strong>
        </span>
      </div>
    `
    )
    .join('');
}

/**
 * Render custody timeline table
 */
function renderCustodyTimeline(timeline) {
  const tbody = document.getElementById('rep-timeline-tbody');
  if (!tbody) return;

  if (timeline.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 18px; color: var(--text-secondary);">No custody transfer records available.</td></tr>';
    return;
  }

  tbody.innerHTML = timeline
    .map((log, index) => {
      const badgeClass = getCustodyActionBadgeClass(log.action);
      const custodianName = log.performedBy ? log.performedBy.name : (log.performedByName || 'System Process');
      const custodianRole = log.performedBy ? (log.performedBy.role || '').toUpperCase() : 'SYSTEM';

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-secondary);">${index + 1}</td>
          <td class="mono" style="font-size: 11.5px; white-space: nowrap;">${formatDate(log.timestamp)}</td>
          <td><span class="badge ${badgeClass}">${formatCustodyAction(log.action)}</span></td>
          <td>
            <strong>${escapeHtml(custodianName)}</strong>
            <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(custodianRole)}</div>
          </td>
          <td style="font-size: 12.5px; color: var(--text-primary); max-width: 320px;">
            ${escapeHtml(log.remarks || 'Standard custody state logging.')}
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Action badge class mapping
 */
function getCustodyActionBadgeClass(action) {
  const act = (action || '').toUpperCase();
  if (act.includes('ACCEPT')) return 'badge-success';
  if (act.includes('VERIF')) return 'badge-info';
  if (act.includes('UPLOAD')) return 'badge-primary';
  if (act.includes('TRANSFER')) return 'badge-warning';
  if (act.includes('CLARIF')) return 'badge-danger';
  return 'badge-secondary';
}

function formatCustodyAction(action) {
  if (!action) return 'EVENT';
  return action.replace('COURT_', '').replace(/_/g, ' ');
}

/**
 * Handle Section 65B XML Export
 */
async function handleExportXml() {
  if (!currentExhibitId) {
    showToast('Please select a court exhibit first.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-export-cert-xml');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Exporting XML...';

  try {
    const res = await api.get(`/court/evidence/${currentExhibitId}/certificate/xml`);
    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const evId = currentReportData?.evidence?.evidenceId || currentExhibitId;
    a.download = `section-65b-certificate-${evId}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast('Section 65B XML Certificate downloaded successfully!', 'success');
  } catch (err) {
    showToast(`XML export failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

/**
 * Handle JSON Dossier Export
 */
function handleExportJson() {
  if (!currentReportData) {
    showToast('No report data loaded to export.', 'warning');
    return;
  }

  try {
    const evId = currentReportData?.evidence?.evidenceId || 'EXHIBIT';
    const jsonString = JSON.stringify(currentReportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `court-dossier-${evId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast('Evidentiary JSON Dossier downloaded successfully!', 'success');
  } catch (err) {
    showToast(`JSON export failed: ${err.message}`, 'error');
  }
}

/**
 * Toggle empty state
 */
function showEmptyState(isEmpty) {
  const emptyBox = document.getElementById('report-empty-state');
  const sheetCard = document.getElementById('report-sheet-card');

  if (emptyBox) emptyBox.style.display = isEmpty ? 'block' : 'none';
  if (sheetCard) sheetCard.style.display = isEmpty ? 'none' : 'block';
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
