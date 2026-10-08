/**
 * P.R.A.M.A.N — Court Evidence Review & Judicial Admissibility Controller
 *
 * @flow COURT_REVIEW
 * @flow COURT_VERIFY
 * @rule COURT_OFFICER_ONLY
 * @rule ORIGINAL_HASH_IMMUTABLE
 * @rule COURT_NOTE_OWNER_ONLY
 */

let activeEvidence = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth(['court_officer', 'admin']);

  const urlParams = new URLSearchParams(window.location.search);
  const evidenceId = urlParams.get('id');

  await populateCourtSelector(evidenceId);

  const selector = document.getElementById('select-court-evidence');
  if (selector) {
    selector.addEventListener('change', () => {
      const selectedId = selector.value;
      if (selectedId) {
        loadEvidenceDossier(selectedId);
      }
    });
  }

  setupReviewActions();
  setupReviewModals();
});

async function populateCourtSelector(preselectedId) {
  const selector = document.getElementById('select-court-evidence');
  if (!selector) return;

  try {
    const res = await api.get('/court/evidence?limit=100');
    if (!res || !res.data) return;

    selector.innerHTML = '<option value="">-- Choose Court-Submitted Exhibit --</option>' +
      res.data
        .map((ev) => `<option value="${ev._id}" ${preselectedId === ev._id ? 'selected' : ''}>${ev.evidenceId} - ${escapeHtml(ev.title)} (${escapeHtml(ev.caseNumber)}) [${ev.courtReviewStatus}]</option>`)
        .join('');

    if (preselectedId) {
      loadEvidenceDossier(preselectedId);
    } else if (res.data.length > 0) {
      selector.value = res.data[0]._id;
      loadEvidenceDossier(res.data[0]._id);
    }
  } catch (err) {
    showToast(`Failed to load court evidence options: ${err.message}`, 'error');
  }
}

async function loadEvidenceDossier(id) {
  try {
    const res = await api.get(`/court/evidence/${id}`);
    if (!res || !res.data) return;

    activeEvidence = res.data;
    renderCourtDossier(activeEvidence);
  } catch (err) {
    showToast(`Access Error: ${err.message}`, 'error');
    const container = document.getElementById('court-dossier-content');
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger" style="margin-top: 20px;">
          <strong>Access Denied:</strong> ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function renderCourtDossier(ev) {
  document.getElementById('court-dossier-content').style.display = 'block';

  document.getElementById('ev-id').textContent = ev.evidenceId;
  document.getElementById('ev-case').textContent = ev.caseNumber;
  document.getElementById('ev-title').textContent = ev.title;
  document.getElementById('ev-type').textContent = ev.evidenceType;
  document.getElementById('ev-filename').textContent = ev.originalFilename;
  document.getElementById('ev-filesize').textContent = formatFileSize(ev.fileSize);
  document.getElementById('ev-uploader').textContent = ev.uploadedBy ? `${ev.uploadedBy.name} (${ev.uploadedBy.role})` : 'System';
  document.getElementById('ev-uploaded-at').textContent = formatDate(ev.uploadedAt || ev.createdAt);
  document.getElementById('ev-holder').textContent = ev.currentHolder ? `${ev.currentHolder.name} (${ev.currentHolder.role})` : 'Unassigned';
  document.getElementById('ev-verified-at').textContent = ev.lastVerifiedAt ? formatDate(ev.lastVerifiedAt) : 'Never verified';
  document.getElementById('ev-desc').textContent = ev.description || 'No description recorded at intake.';

  // Original SHA-256
  document.getElementById('ev-original-hash').textContent = ev.sha256Hash;

  // Status badges
  renderIntegrityBadge(ev.integrityStatus);
  renderCourtStatusBadge(ev.courtReviewStatus);

  // Clarification banner if active
  const clarBanner = document.getElementById('clarification-alert-box');
  if (clarBanner) {
    if (ev.courtReviewStatus === 'Requires Clarification' && ev.courtClarificationReason) {
      clarBanner.style.display = 'block';
      clarBanner.innerHTML = `
        <strong>Clarification Requested by Court:</strong>
        <p style="margin-top: 4px; font-size: 13px;">${escapeHtml(ev.courtClarificationReason)}</p>
      `;
    } else {
      clarBanner.style.display = 'none';
    }
  }

  // Render Separated Notes
  renderCourtNotes(ev.notes || []);

  // Update links
  const custBtn = document.getElementById('btn-court-custody');
  if (custBtn) custBtn.href = `custody.html?evidenceId=${ev._id}`;

  const repBtn = document.getElementById('btn-court-report');
  if (repBtn) repBtn.href = `court-report.html?id=${ev._id}`;
}

function renderIntegrityBadge(status) {
  const el = document.getElementById('ev-integrity-badge');
  if (!el) return;

  if (status === 'Verified') {
    el.className = 'badge badge-success';
    el.textContent = 'INTEGRITY VERIFIED';
  } else if (status === 'Failed') {
    el.className = 'badge badge-danger';
    el.textContent = 'INTEGRITY CHECK FAILED';
  } else {
    el.className = 'badge badge-warning';
    el.textContent = 'NOT CHECKED';
  }
}

function renderCourtStatusBadge(status) {
  const el = document.getElementById('ev-court-status-badge');
  if (!el) return;

  switch (status) {
    case 'Accepted for Court Record':
      el.className = 'badge badge-success';
      el.textContent = 'Accepted for Court Record';
      break;
    case 'Pending Court Review':
      el.className = 'badge badge-warning';
      el.textContent = 'Pending Court Review';
      break;
    case 'Under Court Review':
      el.className = 'badge badge-info';
      el.textContent = 'Under Court Review';
      break;
    case 'Requires Clarification':
      el.className = 'badge badge-danger';
      el.textContent = 'Requires Clarification';
      break;
    default:
      el.className = 'badge badge-secondary';
      el.textContent = status || 'None';
  }
}

function renderCourtNotes(notes) {
  const container = document.getElementById('court-notes-container');
  if (!container) return;

  const courtNotes = notes.filter((n) => n.noteType === 'court');
  const otherNotes = notes.filter((n) => n.noteType !== 'court');

  let html = '';

  if (courtNotes.length > 0) {
    html += '<h4 style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 8px;">⚖️ Judicial Court Observations:</h4>';
    html += courtNotes
      .map(
        (n) => `
        <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 8px;">
          <p style="font-size: 13.5px; color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(n.text)}</p>
          <span style="font-size: 11.5px; color: var(--text-secondary);">Recorded by <strong>${escapeHtml(n.addedByName || 'Court Officer')}</strong> • ${formatDate(n.addedAt)}</span>
        </div>
      `
      )
      .join('');
  } else {
    html += '<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">No judicial review notes recorded yet.</p>';
  }

  if (otherNotes.length > 0) {
    html += '<h4 style="font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-top: 14px; margin-bottom: 8px;">📋 Investigating / Forensic Notes:</h4>';
    html += otherNotes
      .map(
        (n) => `
        <div style="background: var(--surface); border-left: 3px solid var(--border-strong); padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 6px;">
          <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">${escapeHtml(n.text)}</p>
          <span style="font-size: 11px; color: var(--text-secondary);">Logged by ${escapeHtml(n.addedByName || 'Officer')} (${n.noteType}) • ${formatDate(n.addedAt)}</span>
        </div>
      `
      )
      .join('');
  }

  container.innerHTML = html;
}

function setupReviewActions() {
  // Court Verification Flow
  const verifyBtn = document.getElementById('btn-court-verify');
  const resultCard = document.getElementById('court-verification-box');

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      if (!activeEvidence) return;

      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Calculating File Hash...';

      try {
        const res = await api.post(`/court/evidence/${activeEvidence._id}/verify`, {});
        const data = res.data;

        renderIntegrityBadge(data.integrityStatus);
        document.getElementById('ev-verified-at').textContent = formatDate(data.verifiedAt);

        if (resultCard) {
          resultCard.style.display = 'block';
          const isMatch = data.isMatch;

          resultCard.className = `card ${isMatch ? 'alert-success' : 'alert-danger'}`;
          resultCard.innerHTML = `
            <div style="display: flex; gap: 14px; align-items: flex-start;">
              <span style="font-size: 24px;">${isMatch ? '🛡️' : '⚠️'}</span>
              <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">
                  Judicial Hash Verification: ${data.verificationResult}
                </h4>
                <p style="font-size: 13px; margin-bottom: 8px;">
                  ${isMatch
                    ? 'The current cryptographic SHA-256 digest calculated directly from the file stream matches the intake baseline digest.'
                    : 'CRITICAL ALERT: Current calculated hash does NOT match the original intake reference hash!'
                  }
                </p>
                <div class="mono" style="font-size: 12px; line-height: 1.6; word-break: break-all;">
                  <div><strong>Original Baseline: </strong>${data.originalHash}</div>
                  <div><strong>Current Computed: </strong>${data.currentHash || 'FILE MISSING'}</div>
                  <div><strong>Verified By:       </strong>${escapeHtml(data.verifiedBy)} at ${formatDate(data.verifiedAt)}</div>
                </div>
              </div>
            </div>
          `;
        }

        showToast(data.verificationResult, data.isMatch ? 'success' : 'error');
      } catch (err) {
        showToast(`Verification error: ${err.message}`, 'error');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Evidence Integrity';
      }
    });
  }

  // Copy Original Hash Button
  const copyBtn = document.getElementById('btn-copy-orig-hash');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const hash = document.getElementById('ev-original-hash')?.textContent;
      if (hash) {
        navigator.clipboard.writeText(hash);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1800);
      }
    });
  }
}

function setupReviewModals() {
  // 1. Accept For Court Record Modal
  const modalAccept = document.getElementById('modal-court-accept');
  const openAcceptBtn = document.getElementById('btn-open-accept');
  const closeAcceptBtn = document.getElementById('btn-close-accept');
  const cancelAcceptBtn = document.getElementById('btn-cancel-accept');
  const confirmAcceptBtn = document.getElementById('btn-confirm-accept');

  if (openAcceptBtn && modalAccept) {
    openAcceptBtn.addEventListener('click', () => {
      if (!activeEvidence) return;

      document.getElementById('accept-info-id').textContent = activeEvidence.evidenceId;
      document.getElementById('accept-info-case').textContent = activeEvidence.caseNumber;
      document.getElementById('accept-info-integrity').textContent = activeEvidence.integrityStatus;
      document.getElementById('accept-info-hash').textContent = activeEvidence.sha256Hash;

      modalAccept.classList.add('active');
    });
  }

  const closeAccept = () => modalAccept?.classList.remove('active');
  if (closeAcceptBtn) closeAcceptBtn.addEventListener('click', closeAccept);
  if (cancelAcceptBtn) cancelAcceptBtn.addEventListener('click', closeAccept);

  if (confirmAcceptBtn) {
    confirmAcceptBtn.addEventListener('click', async () => {
      confirmAcceptBtn.disabled = true;
      confirmAcceptBtn.textContent = 'Recording Acceptance...';

      try {
        const res = await api.post(`/court/evidence/${activeEvidence._id}/accept`, {});
        showToast('Evidence formally accepted for official court record!', 'success');
        closeAccept();
        await loadEvidenceDossier(activeEvidence._id);
      } catch (err) {
        showToast(`Acceptance failed: ${err.message}`, 'error');
      } finally {
        confirmAcceptBtn.disabled = false;
        confirmAcceptBtn.textContent = 'Accept for Court Record';
      }
    });
  }

  // 2. Request Clarification Modal
  const modalClar = document.getElementById('modal-court-clarification');
  const openClarBtn = document.getElementById('btn-open-clarification');
  const closeClarBtn = document.getElementById('btn-close-clar');
  const cancelClarBtn = document.getElementById('btn-cancel-clar');
  const submitClarBtn = document.getElementById('btn-submit-clar');
  const clarReasonInput = document.getElementById('clarification-reason');

  if (openClarBtn && modalClar) {
    openClarBtn.addEventListener('click', () => {
      clarReasonInput.value = '';
      modalClar.classList.add('active');
    });
  }

  const closeClar = () => modalClar?.classList.remove('active');
  if (closeClarBtn) closeClarBtn.addEventListener('click', closeClar);
  if (cancelClarBtn) cancelClarBtn.addEventListener('click', closeClar);

  if (submitClarBtn) {
    submitClarBtn.addEventListener('click', async () => {
      const reason = clarReasonInput.value.trim();

      if (!reason) {
        showToast('A reason for requesting clarification is required.', 'warning');
        return;
      }

      submitClarBtn.disabled = true;
      submitClarBtn.textContent = 'Submitting Request...';

      try {
        await api.post(`/court/evidence/${activeEvidence._id}/clarification`, { reason });
        showToast('Clarification request registered and audit logged.', 'success');
        closeClar();
        await loadEvidenceDossier(activeEvidence._id);
      } catch (err) {
        showToast(`Request failed: ${err.message}`, 'error');
      } finally {
        submitClarBtn.disabled = false;
        submitClarBtn.textContent = 'Submit Clarification Request';
      }
    });
  }

  // 3. Add Court Note Modal
  const modalNote = document.getElementById('modal-court-note');
  const openNoteBtn = document.getElementById('btn-open-court-note');
  const closeNoteBtn = document.getElementById('btn-close-note');
  const cancelNoteBtn = document.getElementById('btn-cancel-note');
  const submitNoteBtn = document.getElementById('btn-submit-court-note');
  const noteTextInput = document.getElementById('court-note-text');

  if (openNoteBtn && modalNote) {
    openNoteBtn.addEventListener('click', () => {
      noteTextInput.value = '';
      modalNote.classList.add('active');
    });
  }

  const closeNote = () => modalNote?.classList.remove('active');
  if (closeNoteBtn) closeNoteBtn.addEventListener('click', closeNote);
  if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', closeNote);

  if (submitNoteBtn) {
    submitNoteBtn.addEventListener('click', async () => {
      const text = noteTextInput.value.trim();
      if (!text) {
        showToast('Court review note text cannot be blank.', 'warning');
        return;
      }

      submitNoteBtn.disabled = true;
      submitNoteBtn.textContent = 'Saving Note...';

      try {
        const res = await api.post(`/court/evidence/${activeEvidence._id}/notes`, { text });
        showToast('Court review note recorded!', 'success');
        closeNote();
        renderCourtNotes(res.data);
      } catch (err) {
        showToast(`Failed to record note: ${err.message}`, 'error');
      } finally {
        submitNoteBtn.disabled = false;
        submitNoteBtn.textContent = 'Record Court Note';
      }
    });
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
