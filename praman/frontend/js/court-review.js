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

  // Judicial Action Buttons State Management
  const openAcceptBtn = document.getElementById('btn-open-accept');
  const openClarBtn = document.getElementById('btn-open-clarification');
  const openNoteBtn = document.getElementById('btn-open-court-note');

  const isAccepted = ev.courtReviewStatus === 'Accepted for Court Record';
  const isClarification = ev.courtReviewStatus === 'Requires Clarification';

  if (openAcceptBtn) {
    if (isAccepted) {
      openAcceptBtn.disabled = true;
      openAcceptBtn.classList.add('disabled-btn');
      openAcceptBtn.style.pointerEvents = 'none';
      openAcceptBtn.style.opacity = '0.85';
      openAcceptBtn.style.cursor = 'not-allowed';
      openAcceptBtn.innerHTML = '✓ Accepted for Court Record';
      openAcceptBtn.title = 'Evidence has already been formally accepted into the official court record.';
    } else if (isClarification) {
      openAcceptBtn.disabled = true;
      openAcceptBtn.classList.add('disabled-btn');
      openAcceptBtn.style.pointerEvents = 'none';
      openAcceptBtn.style.opacity = '0.45';
      openAcceptBtn.style.cursor = 'not-allowed';
      openAcceptBtn.innerHTML = 'Accept for Court Record';
      openAcceptBtn.title = 'Judicial action paused: Evidence is awaiting clarification from the investigator.';
    } else {
      openAcceptBtn.disabled = false;
      openAcceptBtn.classList.remove('disabled-btn');
      openAcceptBtn.style.pointerEvents = 'auto';
      openAcceptBtn.style.opacity = '1';
      openAcceptBtn.style.cursor = 'pointer';
      openAcceptBtn.innerHTML = 'Accept for Court Record';
      openAcceptBtn.title = 'Admit this exhibit into the official court record';
    }
  }

  if (openClarBtn) {
    if (isAccepted) {
      openClarBtn.disabled = true;
      openClarBtn.classList.add('disabled-btn');
      openClarBtn.style.pointerEvents = 'none';
      openClarBtn.style.opacity = '0.45';
      openClarBtn.style.cursor = 'not-allowed';
      openClarBtn.title = 'Evidence exhibit has already been formally accepted into the court record.';
    } else if (isClarification) {
      openClarBtn.disabled = true;
      openClarBtn.classList.add('disabled-btn');
      openClarBtn.style.pointerEvents = 'none';
      openClarBtn.style.opacity = '0.45';
      openClarBtn.style.cursor = 'not-allowed';
      openClarBtn.title = 'Clarification has already been requested. Awaiting resubmission by the investigator.';
    } else {
      openClarBtn.disabled = false;
      openClarBtn.classList.remove('disabled-btn');
      openClarBtn.style.pointerEvents = 'auto';
      openClarBtn.style.opacity = '1';
      openClarBtn.style.cursor = 'pointer';
      openClarBtn.title = 'Request clarification or additional data from investigator';
    }
  }

  if (openNoteBtn) {
    if (isClarification) {
      openNoteBtn.disabled = true;
      openNoteBtn.classList.add('disabled-btn');
      openNoteBtn.style.pointerEvents = 'none';
      openNoteBtn.style.opacity = '0.45';
      openNoteBtn.style.cursor = 'not-allowed';
      openNoteBtn.title = 'Judicial action paused: Cannot add court notes while exhibit is awaiting clarification.';
    } else {
      openNoteBtn.disabled = false;
      openNoteBtn.classList.remove('disabled-btn');
      openNoteBtn.style.pointerEvents = 'auto';
      openNoteBtn.style.opacity = '1';
      openNoteBtn.style.cursor = 'pointer';
      openNoteBtn.title = 'Record judicial observation note';
    }
  }

  // Clarification banner if active
  const clarBanner = document.getElementById('clarification-alert-box');
  if (clarBanner) {
    if (isClarification) {
      clarBanner.style.display = 'block';
      clarBanner.className = 'card alert-warning';
      clarBanner.style.borderLeft = '4px solid #f59e0b';
      clarBanner.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 14px;">
          <div style="flex-shrink: 0; margin-top: 2px;">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" style="color: #f59e0b;">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style="flex: 1;">
            <h4 style="font-size: 15px; font-weight: 700; color: #f59e0b; margin-bottom: 4px;">
              Judicial Review Paused: Clarification Requested
            </h4>
            <p style="font-size: 13.5px; margin-bottom: 6px; color: var(--text-primary);">
              <strong>Clarification Inquiry:</strong> "${escapeHtml(ev.courtClarificationReason || 'Additional forensic verification required.')}"
            </p>
            <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 0;">
              All judicial actions (Accept, Request Clarification, Add Court Note) on this exhibit are paused until the case investigator reviews the query and resubmits the exhibit.
            </p>
          </div>
        </div>
      `;
    } else if (isAccepted) {
      clarBanner.style.display = 'block';
      clarBanner.className = 'card alert-success';
      clarBanner.style.borderLeft = '4px solid var(--success)';
      clarBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--success); flex-shrink: 0;">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
          <span style="font-size: 13.5px; font-weight: 600; color: var(--success);">
            This exhibit has been formally admitted and sealed into the official court record. Judicial actions are complete.
          </span>
        </div>
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
    html += '<h4 style="font-size: 13px; font-weight: 700; color: #f59e0b; margin-bottom: 8px;">Judicial Court Observations:</h4>';
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
    html += '<h4 style="font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-top: 14px; margin-bottom: 8px;">Investigating & Forensic Notes:</h4>';
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
              <div style="flex-shrink: 0; margin-top: 2px;">
                ${isMatch 
                  ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--success);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
                  : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--danger);"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
                }
              </div>
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
      if (activeEvidence.courtReviewStatus === 'Accepted for Court Record') {
        showToast('Evidence has already been accepted into the official court record.', 'info');
        return;
      }
      if (activeEvidence.courtReviewStatus === 'Requires Clarification') {
        showToast('Judicial actions are paused: Awaiting clarification response from the investigator.', 'warning');
        return;
      }

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
      if (confirmAcceptBtn.disabled) return;

      confirmAcceptBtn.disabled = true;
      confirmAcceptBtn.textContent = 'Recording Acceptance...';
      if (openAcceptBtn) openAcceptBtn.disabled = true;
      if (openClarBtn) openClarBtn.disabled = true;

      try {
        const res = await api.post(`/court/evidence/${activeEvidence._id}/accept`, {});
        showToast('Evidence formally accepted for official court record!', 'success');
        closeAccept();
        await loadEvidenceDossier(activeEvidence._id);
      } catch (err) {
        showToast(`Acceptance failed: ${err.message}`, 'error');
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
      if (!activeEvidence) return;
      if (activeEvidence.courtReviewStatus === 'Accepted for Court Record') {
        showToast('Cannot request clarification: Evidence is already admitted into the court record.', 'info');
        return;
      }
      if (activeEvidence.courtReviewStatus === 'Requires Clarification') {
        showToast('Clarification has already been requested. Awaiting resubmission by the investigator.', 'info');
        return;
      }

      clarReasonInput.value = '';
      modalClar.classList.add('active');
    });
  }

  const closeClar = () => modalClar?.classList.remove('active');
  if (closeClarBtn) closeClarBtn.addEventListener('click', closeClar);
  if (cancelClarBtn) cancelClarBtn.addEventListener('click', closeClar);

  if (submitClarBtn) {
    submitClarBtn.addEventListener('click', async () => {
      if (submitClarBtn.disabled) return;

      const reason = clarReasonInput.value.trim();
      if (!reason) {
        showToast('A reason for requesting clarification is required.', 'warning');
        return;
      }

      submitClarBtn.disabled = true;
      submitClarBtn.textContent = 'Submitting Request...';
      if (openAcceptBtn) openAcceptBtn.disabled = true;
      if (openClarBtn) openClarBtn.disabled = true;
      if (openNoteBtn) openNoteBtn.disabled = true;

      try {
        await api.post(`/court/evidence/${activeEvidence._id}/clarification`, { reason });
        showToast('Clarification request registered. Judicial review paused until resubmission.', 'success');
        closeClar();
        await loadEvidenceDossier(activeEvidence._id);
      } catch (err) {
        showToast(`Request failed: ${err.message}`, 'error');
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
      if (!activeEvidence) return;
      if (activeEvidence.courtReviewStatus === 'Requires Clarification') {
        showToast('Judicial actions are paused: Cannot add notes until investigator resubmits.', 'warning');
        return;
      }

      noteTextInput.value = '';
      modalNote.classList.add('active');
    });
  }

  const closeNote = () => modalNote?.classList.remove('active');
  if (closeNoteBtn) closeNoteBtn.addEventListener('click', closeNote);
  if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', closeNote);

  if (submitNoteBtn) {
    submitNoteBtn.addEventListener('click', async () => {
      if (submitNoteBtn.disabled) return;

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

  // 4. Evidence Preview Modal
  const modalPreview = document.getElementById('modal-court-preview');
  const openPreviewBtn = document.getElementById('btn-court-preview');
  const closePreviewBtn = document.getElementById('btn-close-preview');
  const dismissPreviewBtn = document.getElementById('btn-dismiss-preview');
  const previewContainer = document.getElementById('preview-container');
  const previewFilenameEl = document.getElementById('preview-filename');
  const previewFilesizeEl = document.getElementById('preview-filesize');
  const previewExhibitIdEl = document.getElementById('preview-exhibit-id');
  const previewFileBadgeEl = document.getElementById('preview-file-badge');
  const previewNewTabBtn = document.getElementById('btn-preview-newtab');

  async function openEvidencePreview() {
    if (!activeEvidence) {
      showToast('No exhibit selected to preview.', 'warning');
      return;
    }

    if (previewExhibitIdEl) previewExhibitIdEl.textContent = activeEvidence.evidenceId;
    if (previewFilenameEl) previewFilenameEl.textContent = activeEvidence.originalFilename;
    if (previewFilesizeEl) previewFilesizeEl.textContent = formatFileSize(activeEvidence.fileSize);
    if (previewFileBadgeEl) previewFileBadgeEl.textContent = activeEvidence.evidenceType || 'Document';

    const token = getToken();
    const previewUrl = `/api/court/evidence/${activeEvidence._id}/preview?token=${token}`;
    if (previewNewTabBtn) {
      previewNewTabBtn.href = previewUrl;
    }

    const filename = (activeEvidence.originalFilename || '').toLowerCase();
    const ext = filename.substring(filename.lastIndexOf('.'));

    if (previewContainer) {
      previewContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-secondary);"><p>Loading exhibit preview...</p></div>';

      if (ext === '.pdf') {
        previewContainer.innerHTML = `
          <iframe src="${previewUrl}#toolbar=1&navpanes=0" style="width: 100%; height: 580px; border: none; border-radius: var(--radius-sm);" title="Evidence PDF Document"></iframe>
        `;
      } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
        previewContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; width: 100%;">
            <img src="${previewUrl}" alt="Evidence Preview" style="max-width: 100%; max-height: 520px; object-fit: contain; border-radius: var(--radius-sm); box-shadow: var(--shadow-sm);" />
          </div>
        `;
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        previewContainer.innerHTML = `
          <div style="padding: 48px 24px; text-align: center; width: 100%;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            </div>
            <h4 style="font-size: 15px; margin-bottom: 12px;">Audio Exhibit Recording</h4>
            <audio controls src="${previewUrl}" style="width: 80%; max-width: 500px; margin-bottom: 12px;"></audio>
            <p style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(activeEvidence.originalFilename)}</p>
          </div>
        `;
      } else if (['.mp4', '.webm', '.mov'].includes(ext)) {
        previewContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; width: 100%;">
            <video controls src="${previewUrl}" style="max-width: 100%; max-height: 520px; border-radius: var(--radius-sm);"></video>
          </div>
        `;
      } else if (['.txt', '.log', '.json', '.csv', '.xml', '.html', '.js', '.py'].includes(ext)) {
        try {
          const resp = await fetch(previewUrl);
          if (!resp.ok) throw new Error('Could not fetch file content');
          const text = await resp.text();
          previewContainer.innerHTML = `
            <pre style="width: 100%; height: 520px; overflow: auto; padding: 18px; font-family: var(--font-mono); font-size: 13px; background: #0f172a; color: #f8fafc; border-radius: var(--radius-sm); white-space: pre-wrap; word-break: break-all; margin: 0; box-sizing: border-box;"><code>${escapeHtml(text)}</code></pre>
          `;
        } catch (e) {
          previewContainer.innerHTML = `
            <div style="padding: 30px; text-align: center;">
              <p style="color: var(--danger); margin-bottom: 12px;">Failed to display text content inline.</p>
              <a href="${previewUrl}" target="_blank" class="btn btn-secondary btn-sm">Open in New Window</a>
            </div>
          `;
        }
      } else {
        // Fallback for binary / disk images / other formats
        previewContainer.innerHTML = `
          <div style="padding: 40px 24px; text-align: center; max-width: 500px; margin: auto;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(37, 99, 235, 0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            </div>
            <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 8px;">Forensic Exhibit: ${escapeHtml(activeEvidence.evidenceType || 'Binary File')}</h4>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
              File <strong>${escapeHtml(activeEvidence.originalFilename)}</strong> is a raw image / binary stream. You can inspect its stream in a new tab or forensic tool.
            </p>
            <div style="background: var(--surface); padding: 12px; border-radius: var(--radius-sm); font-size: 12px; text-align: left; margin-bottom: 18px; border: 1px solid var(--border);">
              <div><strong>File Size:</strong> ${formatFileSize(activeEvidence.fileSize)}</div>
              <div><strong>Integrity Digest:</strong> <span class="mono" style="font-size: 11px; word-break: break-all;">${activeEvidence.sha256Hash}</span></div>
            </div>
            <a href="${previewUrl}" target="_blank" class="btn btn-primary btn-sm">Open Raw Exhibit Stream</a>
          </div>
        `;
      }
    }

    modalPreview.classList.add('active');
  }

  if (openPreviewBtn && modalPreview) {
    openPreviewBtn.addEventListener('click', openEvidencePreview);
  }

  const closePreview = () => modalPreview?.classList.remove('active');
  if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreview);
  if (dismissPreviewBtn) dismissPreviewBtn.addEventListener('click', closePreview);

  // Check if URL query requests immediate preview
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('preview') === '1') {
    setTimeout(openEvidencePreview, 400);
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
