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

  // Update download link
  const dlBtn = document.getElementById('btn-download-file');
  if (dlBtn) {
    dlBtn.onclick = () => {
      window.location.href = `/api/evidence/${ev._id}/download?token=${getToken()}`;
    };
  }

  // Chain of custody link
  const custodyBtn = document.getElementById('btn-view-custody');
  if (custodyBtn) {
    custodyBtn.href = `custody.html?evidenceId=${ev._id}`;
  }

  // Strict Role Permissions Enforcement for Action Buttons
  const user = getUser();
  const transferBtn = document.getElementById('btn-open-transfer');
  const noteBtn = document.getElementById('btn-open-note');
  const courtSubmitBtn = document.getElementById('btn-open-court-submit');

  if (user.role === 'admin') {
    // System Admin is an observer for governance: NO evidence modification or transfer
    if (transferBtn) transferBtn.style.display = 'none';
    if (noteBtn) noteBtn.style.display = 'none';
    if (courtSubmitBtn) courtSubmitBtn.style.display = 'none';
  } else {
    const isHolder = ev.currentHolder && (ev.currentHolder._id === user.id || ev.currentHolder === user.id || ev.currentHolder.id === user.id);
    const isUploader = ev.uploadedBy && (ev.uploadedBy._id === user.id || ev.uploadedBy === user.id || ev.uploadedBy.id === user.id);

    if (transferBtn) {
      transferBtn.style.display = (isHolder || isUploader) ? 'inline-flex' : 'none';
      if (user.role === 'investigator') {
        transferBtn.innerHTML = '<span>🔄</span> Assign / Transfer Custody';
      }
    }
    if (noteBtn) {
      noteBtn.style.display = 'inline-flex';
    }
    if (courtSubmitBtn) {
      courtSubmitBtn.style.display = (user.role === 'investigator' || user.role === 'forensic') ? 'inline-flex' : 'none';
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
              <span style="font-size: 24px;">${isMatch ? '🛡️' : '⚠️'}</span>
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
    openTransferBtn.addEventListener('click', async () => {
      try {
        const res = await api.get('/users?active=true');
        if (res && res.data) {
          const user = getUser();
          recipientSelect.innerHTML = '<option value="">-- Select Target Officer / Expert --</option>' +
            res.data
              .filter((u) => u.role !== 'admin' && u._id !== user.id && u.id !== user.id)
              .map((u) => {
                const isForensic = u.role === 'forensic';
                const roleLabel = isForensic ? '🔬 FORENSIC EXPERT' : u.role.toUpperCase();
                return `<option value="${u._id}">${escapeHtml(u.name)} (${roleLabel}) - ${escapeHtml(u.email)}</option>`;
              })
              .join('');
        }
      } catch (e) {
        showToast('Could not load user list', 'error');
      }
      transferModal.classList.add('active');
    });
  }

  const closeTransfer = () => transferModal?.classList.remove('active');
  if (closeTransferBtn) closeTransferBtn.addEventListener('click', closeTransfer);
  if (cancelTransferBtn) cancelTransferBtn.addEventListener('click', closeTransfer);

  if (confirmTransferBtn) {
    confirmTransferBtn.addEventListener('click', async () => {
      const toUserId = recipientSelect.value;
      const remarks = document.getElementById('transfer-remarks').value.trim();

      if (!toUserId) {
        showToast('Please select a recipient.', 'warning');
        return;
      }

      confirmTransferBtn.disabled = true;
      confirmTransferBtn.textContent = 'Routing...';

      try {
        await api.post('/custody/transfer', {
          evidenceId: currentEvidence._id,
          toUserId,
          remarks: remarks || 'Assigned / Transferred in workflow chain.',
        });

        showToast('Custody / Assignment routed successfully!', 'success');
        closeTransfer();
        await loadEvidenceDetails(currentEvidence._id);
      } catch (err) {
        showToast(`Transfer failed: ${err.message}`, 'error');
      } finally {
        confirmTransferBtn.disabled = false;
        confirmTransferBtn.textContent = 'Confirm Transfer';
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
    openNoteBtn.addEventListener('click', () => {
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

      confirmCourtBtn.disabled = true;
      confirmCourtBtn.textContent = 'Submitting...';

      try {
        await api.post(`/court/submit/${currentEvidence._id}`, {
          courtOfficerId,
          remarks,
        });

        showToast('Evidence formally submitted for judicial court review!', 'success');
        closeCourtModal();
        await loadEvidenceDetails(currentEvidence._id);
      } catch (err) {
        showToast(`Court submission failed: ${err.message}`, 'error');
      } finally {
        confirmCourtBtn.disabled = false;
        confirmCourtBtn.textContent = 'Submit to Court';
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
