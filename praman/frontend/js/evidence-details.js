/**
 * P.R.A.M.A.N — Evidence Detailed View & Verification Controller
 */

let currentEvidence = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const evidenceId = urlParams.get('id');

  if (!evidenceId) {
    showToast('No evidence specified. Redirecting...', 'warning');
    setTimeout(() => (window.location.href = 'evidence.html'), 1000);
    return;
  }

  await loadEvidenceDetails(evidenceId);
  setupActions();
  setupModals();
});

async function loadEvidenceDetails(id) {
  try {
    const res = await api.get(`/evidence/${id}`);
    if (!res || !res.data) return;

    currentEvidence = res.data;
    renderDetails(currentEvidence);
  } catch (err) {
    showToast(`Failed to load evidence: ${err.message}`, 'error');
  }
}

function renderDetails(ev) {
  document.getElementById('display-id').textContent = ev.evidenceId;
  document.getElementById('display-title').textContent = ev.title;
  document.getElementById('display-case').textContent = ev.caseNumber;
  document.getElementById('display-desc').textContent = ev.description || 'No description provided.';
  document.getElementById('display-type').textContent = ev.evidenceType;
  document.getElementById('display-filename').textContent = ev.originalFilename;
  document.getElementById('display-filesize').textContent = formatFileSize(ev.fileSize);
  document.getElementById('display-uploader').textContent = ev.uploadedBy ? `${ev.uploadedBy.name} (${ev.uploadedBy.role})` : 'System';
  document.getElementById('display-uploaded-at').textContent = formatDate(ev.uploadedAt || ev.createdAt);
  document.getElementById('display-holder').textContent = ev.currentHolder ? `${ev.currentHolder.name} (${ev.currentHolder.role})` : 'Unassigned';
  document.getElementById('display-status').textContent = ev.status;
  document.getElementById('display-verified-at').textContent = ev.lastVerifiedAt ? formatDate(ev.lastVerifiedAt) : 'Never verified';

  // Reference SHA-256 Hash
  const hashEl = document.getElementById('display-hash');
  if (hashEl) hashEl.textContent = ev.sha256Hash;

  // Integrity Status Badge
  renderIntegrityBadge(ev.integrityStatus);

  // Render Notes Timeline
  renderNotes(ev.notes || []);

  // Update download link (hidden for admin)
  const dlBtn = document.getElementById('btn-download-file');
  const user = getUser();
  if (dlBtn) {
    if (user && user.role === 'admin') {
      dlBtn.style.display = 'none';
    } else {
      dlBtn.style.display = 'inline-flex';
      dlBtn.onclick = () => {
        window.location.href = `/api/evidence/${ev._id}/download?token=${getToken()}`;
      };
    }
  }

  // Judicial / Court Status Display
  const courtStatusEl = document.getElementById('display-court-status');
  const isSubmittedToCourt = Boolean(ev.courtReviewStatus && ev.courtReviewStatus !== 'None');
  const isClarificationNeeded = ev.courtReviewStatus === 'Requires Clarification';
  const isCourtAccepted = ev.courtReviewStatus === 'Accepted for Court Record';
  const isLockedByCourt = isSubmittedToCourt && !isClarificationNeeded;

  if (courtStatusEl) {
    courtStatusEl.textContent = isSubmittedToCourt ? ev.courtReviewStatus : 'Not Submitted';
    if (isCourtAccepted) {
      courtStatusEl.style.color = 'var(--success)';
    } else if (isClarificationNeeded) {
      courtStatusEl.style.color = '#f59e0b';
    } else if (isSubmittedToCourt) {
      courtStatusEl.style.color = 'var(--cyan)';
    } else {
      courtStatusEl.style.color = 'var(--text-secondary)';
    }
  }

  // Clarification Alert Banner (displays presiding judge's inquiry to investigator)
  const clarBanner = document.getElementById('clarification-alert-banner');
  const clarText = document.getElementById('clarification-alert-text');
  const clarMeta = document.getElementById('clarification-alert-meta');
  if (clarBanner) {
    if (isClarificationNeeded) {
      clarBanner.style.display = 'block';
      if (clarText) {
        clarText.innerHTML = `<strong>Court Clarification Query:</strong> "${escapeHtml(ev.courtClarificationReason || 'Additional forensic verification requested by the court.')}"`;
      }
      if (clarMeta) {
        const reviewer = ev.courtReviewedBy ? (ev.courtReviewedBy.name || 'Court Officer') : 'Presiding Court Officer';
        clarMeta.textContent = `Issued by: ${reviewer} • Status: Awaiting Investigator Response & Resubmission`;
      }
    } else {
      clarBanner.style.display = 'none';
    }
  }

  // Chain of custody link
  const custodyBtn = document.getElementById('btn-view-custody');
  if (custodyBtn) {
    custodyBtn.href = `custody.html?evidenceId=${ev._id}`;
  }

  // Strict Role Permissions Enforcement for Action Buttons
  const transferBtn = document.getElementById('btn-open-transfer');
  const noteBtn = document.getElementById('btn-open-note');
  const courtSubmitBtn = document.getElementById('btn-open-court-submit');

  if (user && user.role === 'admin') {
    // System Admin is an observer for governance: NO evidence modification, transfer, or downloading
    if (transferBtn) transferBtn.style.display = 'none';
    if (noteBtn) noteBtn.style.display = 'none';
    if (courtSubmitBtn) courtSubmitBtn.style.display = 'none';
    if (dlBtn) dlBtn.style.display = 'none';
  } else {
    const isHolder = ev.currentHolder && (ev.currentHolder._id === user.id || ev.currentHolder === user.id || ev.currentHolder.id === user.id);
    const isUploader = ev.uploadedBy && (ev.uploadedBy._id === user.id || ev.uploadedBy === user.id || ev.uploadedBy.id === user.id);

    const uploaderId = String(ev.uploadedBy?._id || ev.uploadedBy?.id || ev.uploadedBy || '');
    const currentHolderId = String(ev.currentHolder?._id || ev.currentHolder?.id || ev.currentHolder || '');
    const isCustodyTransferredOut = Boolean(uploaderId && currentHolderId && uploaderId !== currentHolderId);

    if (transferBtn) {
      if (user.role === 'forensic') {
        // In forensic panel: Replace Transfer Custody feature with Return Custody feature
        if (isHolder) {
          transferBtn.style.display = 'inline-flex';
          transferBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 4px; vertical-align: middle;"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg> Return Custody';
          transferBtn.title = 'Return evidence custody and findings note back to the case investigator';

          if (isLockedByCourt) {
            transferBtn.disabled = true;
            transferBtn.classList.add('disabled-btn');
            transferBtn.title = isCourtAccepted
              ? 'Custody return is prohibited: This evidence has been formally accepted into the official court record.'
              : `Custody return is disabled while evidence is under court review (${ev.courtReviewStatus}).`;
          } else {
            transferBtn.disabled = false;
            transferBtn.classList.remove('disabled-btn');
          }
        } else {
          // Forensic officer does not hold custody
          transferBtn.style.display = 'none';
        }
      } else if (user.role === 'investigator') {
        transferBtn.style.display = 'inline-flex';
        transferBtn.innerHTML = 'Assign / Transfer Custody';

        if (isLockedByCourt) {
          transferBtn.disabled = true;
          transferBtn.classList.add('disabled-btn');
          transferBtn.title = isCourtAccepted
            ? 'Custody transfer is prohibited: This evidence has been formally accepted into the official court record.'
            : `Custody transfer is disabled while evidence is under court review (${ev.courtReviewStatus}).`;
        } else if (isCustodyTransferredOut) {
          // Evidence is currently with forensic expert; investigator cannot transfer it further until returned
          transferBtn.disabled = true;
          transferBtn.classList.add('disabled-btn');
          transferBtn.title = `Evidence is currently in custody of forensic expert (${ev.currentHolder?.name || 'Forensic Lab'}). Awaiting custody return.`;
        } else {
          transferBtn.disabled = false;
          transferBtn.classList.remove('disabled-btn');
          transferBtn.title = isClarificationNeeded ? 'Custody transfer re-enabled to address court clarification requirements.' : 'Assign evidence custody to forensic laboratory or officer';
        }
      } else {
        transferBtn.style.display = (isHolder || isUploader) ? 'inline-flex' : 'none';
      }
    }

    if (noteBtn) {
      noteBtn.style.display = 'inline-flex';

      // Adding notes remains disabled while in court review AND after being accepted into court record.
      // It is ONLY activated when judge requests clarification.
      if (isLockedByCourt) {
        noteBtn.disabled = true;
        noteBtn.classList.add('disabled-btn');
        noteBtn.title = isCourtAccepted
          ? 'Adding notes is prohibited: This evidence has been formally accepted into the official court record.'
          : `Adding notes is disabled while evidence is under court review (${ev.courtReviewStatus}).`;
      } else {
        noteBtn.disabled = false;
        noteBtn.classList.remove('disabled-btn');
        noteBtn.title = isClarificationNeeded ? 'Add clarifying forensic notes to resolve the court inquiry.' : '';
      }
    }

    if (courtSubmitBtn) {
      if (user.role !== 'investigator') {
        // In forensic and other non-investigator panels: remove submit to court button completely
        courtSubmitBtn.style.display = 'none';
      } else {
        courtSubmitBtn.style.display = 'inline-flex';

        if (isCourtAccepted) {
          courtSubmitBtn.disabled = true;
          courtSubmitBtn.classList.add('btn-submitted');
          courtSubmitBtn.style.pointerEvents = 'none';
          courtSubmitBtn.style.opacity = '0.9';
          courtSubmitBtn.style.background = 'rgba(16, 185, 129, 0.12)';
          courtSubmitBtn.style.borderColor = 'var(--success)';
          courtSubmitBtn.style.color = 'var(--success)';
          courtSubmitBtn.innerHTML = '✓ Accepted for Court Record';
          courtSubmitBtn.title = 'This evidence has been admitted into the official court record.';
        } else if (isClarificationNeeded) {
          courtSubmitBtn.disabled = false;
          courtSubmitBtn.classList.remove('btn-submitted');
          courtSubmitBtn.classList.remove('disabled-btn');
          courtSubmitBtn.style.pointerEvents = 'auto';
          courtSubmitBtn.style.opacity = '1';
          courtSubmitBtn.style.background = '#f59e0b';
          courtSubmitBtn.style.borderColor = '#d97706';
          courtSubmitBtn.style.color = '#ffffff';
          courtSubmitBtn.innerHTML = 'Resubmit to Court';
          courtSubmitBtn.title = 'Resubmit this evidence to court with clarification response';
        } else if (isSubmittedToCourt) {
          courtSubmitBtn.disabled = true;
          courtSubmitBtn.classList.add('btn-submitted');
          courtSubmitBtn.style.pointerEvents = 'none';
          courtSubmitBtn.style.opacity = '0.75';
          courtSubmitBtn.style.background = 'rgba(14, 165, 233, 0.12)';
          courtSubmitBtn.style.borderColor = 'var(--cyan)';
          courtSubmitBtn.style.color = 'var(--cyan)';
          courtSubmitBtn.innerHTML = `Submitted to Court (${escapeHtml(ev.courtReviewStatus)})`;
          courtSubmitBtn.title = `Evidence is currently under judicial review: ${ev.courtReviewStatus}`;
        } else if (isCustodyTransferredOut) {
          // Evidence is currently assigned/transferred out: disable submit to court until all custody is returned
          courtSubmitBtn.disabled = true;
          courtSubmitBtn.classList.add('disabled-btn');
          courtSubmitBtn.style.pointerEvents = 'none';
          courtSubmitBtn.style.opacity = '0.6';
          courtSubmitBtn.style.background = 'var(--surface)';
          courtSubmitBtn.style.borderColor = 'var(--border)';
          courtSubmitBtn.style.color = 'var(--text-secondary)';
          courtSubmitBtn.innerHTML = 'Submit to Court';
          courtSubmitBtn.title = 'Evidence is currently assigned to forensic lab/officer. Submit to Court is only active once custody has been returned to the investigator.';
        } else {
          courtSubmitBtn.disabled = false;
          courtSubmitBtn.classList.remove('btn-submitted');
          courtSubmitBtn.classList.remove('disabled-btn');
          courtSubmitBtn.style.pointerEvents = 'auto';
          courtSubmitBtn.style.opacity = '1';
          courtSubmitBtn.style.background = '';
          courtSubmitBtn.style.borderColor = '';
          courtSubmitBtn.style.color = '';
          courtSubmitBtn.innerHTML = 'Submit to Court';
          courtSubmitBtn.title = 'Submit this evidence for judicial court review';
        }
      }
    }
  }
}

function renderIntegrityBadge(status) {
  const badgeContainer = document.getElementById('display-integrity-badge');
  if (!badgeContainer) return;

  if (status === 'Verified') {
    badgeContainer.className = 'badge badge-success';
    badgeContainer.textContent = 'VERIFIED';
  } else if (status === 'Failed') {
    badgeContainer.className = 'badge badge-danger';
    badgeContainer.textContent = 'INTEGRITY CHECK FAILED';
  } else {
    badgeContainer.className = 'badge badge-warning';
    badgeContainer.textContent = 'NOT CHECKED';
  }
}

function renderNotes(notes) {
  const notesContainer = document.getElementById('notes-list');
  if (!notesContainer) return;

  if (notes.length === 0) {
    notesContainer.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">No forensic observations recorded for this evidence.</p>';
    return;
  }

  notesContainer.innerHTML = notes
    .map(
      (n) => `
      <div style="background: var(--surface); padding: 12px 14px; border-radius: var(--radius-sm); margin-bottom: 8px; border-left: 3px solid var(--cyan);">
        <p style="font-size: 13.5px; color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(n.text)}</p>
        <span style="font-size: 11.5px; color: var(--text-secondary);">Added by <strong>${escapeHtml(n.addedByName || (n.addedBy && n.addedBy.name) || 'Officer')}</strong> • ${formatDate(n.addedAt)}</span>
      </div>
    `
    )
    .join('');
}

function setupActions() {
  // Verification Button
  const verifyBtn = document.getElementById('btn-verify');
  const resultCard = document.getElementById('verification-result-card');

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      if (!currentEvidence) return;

      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Recomputing SHA-256...';

      try {
        const res = await api.post(`/evidence/${currentEvidence._id}/verify`, {});
        const data = res.data;

        renderIntegrityBadge(data.integrityStatus);
        document.getElementById('display-verified-at').textContent = formatDate(data.lastVerifiedAt);

        if (resultCard) {
          resultCard.style.display = 'block';
          const isMatch = data.isMatch;

          resultCard.className = `card ${isMatch ? 'alert-success' : 'alert-danger'}`;
          resultCard.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 14px;">
              <div style="flex-shrink: 0; margin-top: 2px;">
                ${isMatch 
                  ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--success);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>'
                  : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" style="color: var(--danger);"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
                }
              </div>
              <div style="flex: 1;">
                <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 6px;">
                  ${isMatch ? 'Cryptographic Hash Verification: PASSED' : 'CRITICAL ALERT: HASH MISMATCH / MODIFIED EVIDENCE'}
                </h4>
                <p style="font-size: 13px; margin-bottom: 8px;">
                  ${isMatch
                    ? 'The SHA-256 hash calculated from the stored file precisely matches the reference hash recorded during evidence intake.'
                    : 'The computed hash of the current file does not match the original intake hash! Integrity breach or unauthorized alteration has been flagged.'
                  }
                </p>
                <div style="font-size: 12px; font-family: var(--font-mono); line-height: 1.6; word-break: break-all;">
                  <div><strong>Reference Hash: </strong>${data.originalHash}</div>
                  <div><strong>Computed Hash:  </strong>${data.currentHash || 'FILE MISSING'}</div>
                </div>
              </div>
            </div>
          `;
        }

        if (data.isMatch) {
          showToast('Integrity Confirmed: SHA-256 hashes match!', 'success');
        } else {
          showToast('INTEGRITY FAILED: File has been altered!', 'error');
        }
      } catch (err) {
        showToast(`Verification error: ${err.message}`, 'error');
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify Integrity';
      }
    });
  }

  // Copy Reference Hash Button
  const copyBtn = document.getElementById('btn-copy-hash');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const hash = document.getElementById('display-hash')?.textContent;
      if (hash) {
        navigator.clipboard.writeText(hash);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1800);
      }
    });
  }
}

function setupModals() {
  // Transfer / Assign Modal
  const transferModal = document.getElementById('modal-transfer');
  const openTransferBtn = document.getElementById('btn-open-transfer');
  const closeTransferBtn = document.getElementById('btn-close-transfer');
  const cancelTransferBtn = document.getElementById('btn-cancel-transfer');
  const confirmTransferBtn = document.getElementById('btn-confirm-transfer');
  const recipientSelect = document.getElementById('transfer-recipient');

  if (openTransferBtn && transferModal) {
    openTransferBtn.addEventListener('click', async (e) => {
      const user = getUser();
      const isForensic = user && user.role === 'forensic';

      const isPending = currentEvidence && currentEvidence.courtReviewStatus && currentEvidence.courtReviewStatus !== 'None' && currentEvidence.courtReviewStatus !== 'Accepted for Court Record';
      if (openTransferBtn.disabled || isPending) {
        e.preventDefault();
        showToast(isForensic ? 'Custody return is disabled while evidence is undergoing judicial court review.' : 'Custody transfer is disabled while evidence is undergoing judicial court review.', 'warning');
        return;
      }

      const modalTitle = document.getElementById('modal-transfer-title');
      const modalDesc = document.getElementById('transfer-modal-desc');
      const recipientGroup = document.getElementById('transfer-recipient-group');
      const returnBox = document.getElementById('return-recipient-box');
      const remarksLabel = document.getElementById('transfer-remarks-label');
      const remarksInput = document.getElementById('transfer-remarks');
      const returnNoteGroup = document.getElementById('return-note-group');
      const returnNoteInput = document.getElementById('return-forensic-note');

      if (isForensic) {
        const uploaderId = String(currentEvidence?.uploadedBy?._id || currentEvidence?.uploadedBy?.id || currentEvidence?.uploadedBy || '');
        const currentHolderId = String(currentEvidence?.currentHolder?._id || currentEvidence?.currentHolder?.id || currentEvidence?.currentHolder || '');
        if (uploaderId && currentHolderId && uploaderId === currentHolderId) {
          showToast('Evidence custody has already been returned to the case investigator.', 'info');
          openTransferBtn.style.display = 'none';
          return;
        }

        // Return Custody UI configuration for forensic panel
        if (modalTitle) modalTitle.textContent = 'Return Custody to Case Investigator';
        if (modalDesc) modalDesc.textContent = 'Returning evidence transfers full custodial responsibility back to the primary case investigator. You can attach your forensic analysis observations and technical notes to the dossier.';
        if (recipientGroup) recipientGroup.style.display = 'none';
        if (returnBox) returnBox.style.display = 'block';

        const uploader = currentEvidence && currentEvidence.uploadedBy;
        const uploaderName = (uploader && uploader.name) ? uploader.name : 'Case Investigator';
        const uploaderEmail = (uploader && uploader.email) ? uploader.email : '';
        const initials = uploaderName.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'IV';

        const nameEl = document.getElementById('return-recipient-name');
        const metaEl = document.getElementById('return-recipient-meta');
        const avatarEl = document.getElementById('return-recipient-avatar');
        if (nameEl) nameEl.textContent = uploaderName;
        if (metaEl) metaEl.textContent = `${uploaderEmail} • Primary Ingestion Officer`;
        if (avatarEl) avatarEl.textContent = initials;

        if (remarksLabel) remarksLabel.textContent = 'Custody Return Remarks';
        if (remarksInput) {
          remarksInput.value = '';
          remarksInput.placeholder = 'e.g., Forensic examination and SHA-256 integrity verification completed. Returning custody to case investigator.';
        }

        if (returnNoteGroup) returnNoteGroup.style.display = 'block';
        if (returnNoteInput) {
          returnNoteInput.value = '';
          returnNoteInput.placeholder = 'Technical observations, hash verification findings, or lab notes to permanently append to the evidence record...';
        }

        if (confirmTransferBtn) {
          confirmTransferBtn.textContent = 'Confirm Return Custody';
        }
      } else {
        // Standard Transfer UI configuration for investigator
        if (modalTitle) modalTitle.textContent = 'Assign / Transfer Custody';
        if (modalDesc) modalDesc.textContent = 'Handing over digital evidence transfers full custodial responsibility to the selected officer. An immutable log entry will be added to the chain of custody.';
        if (recipientGroup) recipientGroup.style.display = 'block';
        if (returnBox) returnBox.style.display = 'none';

        if (remarksLabel) remarksLabel.textContent = 'Custodial Transfer Remarks';
        if (remarksInput) {
          remarksInput.value = '';
          remarksInput.placeholder = 'Specify handover purpose, forensic laboratory assignment, or transfer protocol...';
        }

        if (returnNoteGroup) returnNoteGroup.style.display = 'none';
        if (confirmTransferBtn) {
          confirmTransferBtn.textContent = 'Confirm Assignment / Transfer';
        }

        try {
          const res = await api.get('/users?active=true');
          if (res && res.data) {
            recipientSelect.innerHTML = '<option value="">-- Select Target Officer / Expert --</option>' +
              res.data
                .filter((u) => u.role !== 'admin' && u._id !== user.id && u.id !== user.id)
                .map((u) => {
                  const isUserForensic = u.role === 'forensic';
                  const roleLabel = isUserForensic ? 'FORENSIC EXPERT' : u.role.toUpperCase();
                  return `<option value="${u._id}">${escapeHtml(u.name)} (${roleLabel}) - ${escapeHtml(u.email)}</option>`;
                })
                .join('');
          }
        } catch (e) {
          showToast('Could not load user list', 'error');
        }
      }

      transferModal.classList.add('active');
    });
  }

  const closeTransfer = () => transferModal?.classList.remove('active');
  if (closeTransferBtn) closeTransferBtn.addEventListener('click', closeTransfer);
  if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', closeTransfer);

  if (confirmTransferBtn) {
    confirmTransferBtn.addEventListener('click', async () => {
      const user = getUser();
      const isForensic = user && user.role === 'forensic';

      let toUserId;
      let remarks = document.getElementById('transfer-remarks')?.value.trim();
      let noteText = null;

      if (isForensic) {
        toUserId = currentEvidence?.uploadedBy?._id || currentEvidence?.uploadedBy?.id || currentEvidence?.uploadedBy;
        if (typeof toUserId === 'object' && toUserId) {
          toUserId = toUserId._id || toUserId.id;
        }
        if (!toUserId) {
          showToast('Original case investigator record not found.', 'error');
          return;
        }
        noteText = document.getElementById('return-forensic-note')?.value.trim() || null;
        if (!remarks) {
          remarks = 'Forensic custody returned to primary case investigator.';
        }
      } else {
        toUserId = recipientSelect?.value;
        if (!toUserId) {
          showToast('Please select a recipient.', 'warning');
          return;
        }
        if (!remarks) {
          remarks = 'Assigned / Transferred in workflow chain.';
        }
      }

      confirmTransferBtn.disabled = true;
      confirmTransferBtn.textContent = isForensic ? 'Returning Custody...' : 'Routing...';

      try {
        await api.post('/custody/transfer', {
          evidenceId: currentEvidence._id,
          toUserId,
          remarks,
          noteText: noteText || undefined,
        });

        showToast(isForensic ? 'Evidence custody successfully returned to investigator!' : 'Custody / Assignment routed successfully!', 'success');
        closeTransfer();
        await loadEvidenceDetails(currentEvidence._id);
      } catch (err) {
        showToast(`${isForensic ? 'Return' : 'Transfer'} failed: ${err.message}`, 'error');
        if (err.message && (err.message.includes('already been returned') || err.message.includes('not initiate a transfer'))) {
          closeTransfer();
          await loadEvidenceDetails(currentEvidence._id);
        }
      } finally {
        confirmTransferBtn.disabled = false;
        confirmTransferBtn.textContent = isForensic ? 'Confirm Return Custody' : 'Confirm Assignment / Transfer';
      }
    });
  }

  // Add Note Modal
  const noteModal = document.getElementById('modal-note');
  const openNoteBtn = document.getElementById('btn-open-note');
  const closeNoteBtn = document.getElementById('btn-close-note');
  const cancelNoteBtn = document.getElementById('btn-cancel-note');
  const submitNoteBtn = document.getElementById('btn-submit-note');
  const noteInput = document.getElementById('note-text');

  if (openNoteBtn && noteModal) {
    openNoteBtn.addEventListener('click', (e) => {
      const isPending = currentEvidence && currentEvidence.courtReviewStatus && currentEvidence.courtReviewStatus !== 'None' && currentEvidence.courtReviewStatus !== 'Accepted for Court Record';
      if (openNoteBtn.disabled || isPending) {
        e.preventDefault();
        showToast('Adding notes is disabled while evidence is undergoing judicial court review.', 'warning');
        return;
      }
      noteInput.value = '';
      noteModal.classList.add('active');
    });
  }

  const closeNote = () => noteModal?.classList.remove('active');
  if (closeNoteBtn) closeNoteBtn.addEventListener('click', closeNote);
  if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', closeNote);

  if (submitNoteBtn) {
    submitNoteBtn.addEventListener('click', async () => {
      const text = noteInput.value.trim();
      if (!text) {
        showToast('Please enter note text.', 'warning');
        return;
      }

      submitNoteBtn.disabled = true;
      submitNoteBtn.textContent = 'Saving...';

      try {
        const res = await api.post(`/evidence/${currentEvidence._id}/notes`, { text });
        showToast('Technical observation appended to record!', 'success');
        closeNote();
        renderNotes(res.data);
      } catch (err) {
        showToast(`Failed to add note: ${err.message}`, 'error');
      } finally {
        submitNoteBtn.disabled = false;
        submitNoteBtn.textContent = 'Save Note';
      }
    });
  }

  // Submit to Court Modal
  const courtModal = document.getElementById('modal-court-submit');
  const openCourtBtn = document.getElementById('btn-open-court-submit');
  const closeCourtBtn = document.getElementById('btn-close-court-submit');
  const cancelCourtBtn = document.getElementById('btn-cancel-court-submit');
  const confirmCourtBtn = document.getElementById('btn-confirm-court-submit');
  const courtOfficerSelect = document.getElementById('court-officer-select');

  if (openCourtBtn && courtModal) {
    openCourtBtn.addEventListener('click', async () => {
      const uploaderId = String(currentEvidence?.uploadedBy?._id || currentEvidence?.uploadedBy?.id || currentEvidence?.uploadedBy || '');
      const currentHolderId = String(currentEvidence?.currentHolder?._id || currentEvidence?.currentHolder?.id || currentEvidence?.currentHolder || '');
      const isCustodyTransferredOut = Boolean(uploaderId && currentHolderId && uploaderId !== currentHolderId);

      if (isCustodyTransferredOut) {
        showToast('Cannot submit to court: Evidence is currently assigned/transferred to another officer or forensic lab. Custody must be returned to the primary case investigator before court submission.', 'warning');
        return;
      }

      if (currentEvidence && currentEvidence.courtReviewStatus && currentEvidence.courtReviewStatus !== 'None' && currentEvidence.courtReviewStatus !== 'Requires Clarification') {
        showToast(`This evidence has already been submitted to the court (${currentEvidence.courtReviewStatus}).`, 'info');
        return;
      }

      const isResubmit = currentEvidence && currentEvidence.courtReviewStatus === 'Requires Clarification';
      const modalTitle = document.getElementById('modal-court-title');
      const confirmBtn = document.getElementById('btn-confirm-court-submit');
      const remarksInput = document.getElementById('court-submit-remarks');

      if (modalTitle) {
        modalTitle.textContent = isResubmit ? 'Resubmit Evidence to Court (Clarification Response)' : 'Submit Evidence for Judicial Court Review';
      }
      if (confirmBtn) {
        confirmBtn.textContent = isResubmit ? 'Resubmit to Court' : 'Submit to Court';
      }
      if (remarksInput) {
        remarksInput.value = '';
        remarksInput.placeholder = isResubmit
          ? 'Detail how clarification was resolved (e.g. additional technical notes attached, lab analysis clarified)...'
          : 'e.g. Formal filing for preliminary trial hearing in Case #CR-2026-9042.';
      }

      try {
        const res = await api.get('/users?active=true');
        if (res && res.data) {
          const officers = res.data.filter((u) => u.role === 'court_officer');
          if (officers.length === 0) {
            courtOfficerSelect.innerHTML = '<option value="">-- No designated Court Officer found (will assign to general court) --</option>';
          } else {
            courtOfficerSelect.innerHTML = officers
              .map((o) => `<option value="${o._id}">${escapeHtml(o.name)} - ${escapeHtml(o.email)}</option>`)
              .join('');
          }
        }
      } catch (e) {
        showToast('Could not load officer list', 'error');
      }
      courtModal.classList.add('active');
    });
  }

  const closeCourtModal = () => courtModal?.classList.remove('active');
  if (closeCourtBtn) closeCourtBtn.addEventListener('click', closeCourtModal);
  if (cancelCourtBtn) cancelCourtBtn.addEventListener('click', closeCourtModal);

  if (confirmCourtBtn) {
    confirmCourtBtn.addEventListener('click', async () => {
      const courtOfficerId = courtOfficerSelect?.value || null;
      const remarks = document.getElementById('court-submit-remarks')?.value || '';
      const isResubmit = currentEvidence && currentEvidence.courtReviewStatus === 'Requires Clarification';

      confirmCourtBtn.disabled = true;
      confirmCourtBtn.textContent = isResubmit ? 'Resubmitting...' : 'Submitting...';

      try {
        await api.post(`/court/submit/${currentEvidence._id}`, {
          courtOfficerId,
          remarks,
        });

        showToast(isResubmit ? 'Evidence successfully resubmitted to court with clarification!' : 'Evidence formally submitted for judicial court review!', 'success');
        closeCourtModal();
        await loadEvidenceDetails(currentEvidence._id);
      } catch (err) {
        showToast(`Court submission failed: ${err.message}`, 'error');
      } finally {
        confirmCourtBtn.disabled = false;
        confirmCourtBtn.textContent = isResubmit ? 'Resubmit to Court' : 'Submit to Court';
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
