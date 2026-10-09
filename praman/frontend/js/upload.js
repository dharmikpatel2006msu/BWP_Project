/**
 * P.R.A.M.A.N — Evidence Upload Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(['investigator']);

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('evidence-file');
  const submitBtn = document.getElementById('btn-submit-upload');
  const fileNotice = document.getElementById('file-notice');

  // Show selected file metadata
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        if (file.size > 10 * 1024 * 1024) {
          fileNotice.innerHTML = `<span style="color: var(--danger); font-weight: 600;">File exceeds 10 MB limit (${formatFileSize(file.size)}). Please choose a smaller file.</span>`;
          submitBtn.disabled = true;
        } else {
          fileNotice.innerHTML = `<span style="color: var(--success); font-weight: 600;">Selected: ${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>`;
          submitBtn.disabled = false;
        }
      } else {
        fileNotice.textContent = '';
      }
    });
  }

  // Handle form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('evidence-title').value.trim();
      const caseNumber = document.getElementById('case-number').value.trim();
      const evidenceType = document.getElementById('evidence-type').value;
      const description = document.getElementById('evidence-description').value.trim();
      const notes = document.getElementById('evidence-notes').value.trim();
      const file = fileInput.files[0];

      if (!file) {
        showToast('Please select an evidence file to upload.', 'warning');
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('caseNumber', caseNumber);
      formData.append('evidenceType', evidenceType);
      formData.append('description', description);
      formData.append('notes', notes);
      formData.append('file', file);

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Hashing & Uploading...</span>`;

      try {
        const res = await api.post('/evidence', formData);

        showToast('Evidence securely ingested and SHA-256 hash created!', 'success');

        // Redirect to evidence details page
        setTimeout(() => {
          window.location.href = `evidence-details.html?id=${res.data._id}`;
        }, 1200);
      } catch (err) {
        showToast(`Upload failed: ${err.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Upload Evidence</span>`;
      }
    });
  }
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
