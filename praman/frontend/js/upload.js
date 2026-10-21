/**
 * P.R.A.M.A.N — Evidence Upload Controller
 * Enforces strict category-to-filetype matching and validation
 */

const categoryRules = {
  'Document': {
    extensions: ['.pdf', '.txt', '.docx', '.doc', '.log', '.rtf', '.odt'],
    accept: '.pdf,.txt,.docx,.doc,.log,.rtf,.odt,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'PDF, TXT, DOCX, DOC, LOG documents',
  },
  'Image': {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg'],
    accept: 'image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp',
    label: 'JPG, PNG, JPEG, WEBP images',
  },
  'Audio': {
    extensions: ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'],
    accept: 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac',
    label: 'MP3, WAV, M4A, AAC, OGG audio files',
  },
  'Video': {
    extensions: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'],
    accept: 'video/*,.mp4,.mkv,.avi,.mov,.wmv,.webm',
    label: 'MP4, MKV, AVI, MOV video files',
  },
  'Disk Image': {
    extensions: ['.dd', '.raw', '.img', '.iso', '.bin', '.vmdk', '.e01'],
    accept: '.dd,.raw,.img,.iso,.bin,.vmdk,.e01',
    label: 'DD, RAW, IMG, ISO, BIN disk images',
  },
  'Memory Dump': {
    extensions: ['.dmp', '.dump', '.raw', '.bin', '.mem'],
    accept: '.dmp,.dump,.raw,.bin,.mem',
    label: 'DMP, DUMP, RAW, MEM memory files',
  },
  'Network Log': {
    extensions: ['.pcap', '.pcapng', '.cap', '.log', '.txt'],
    accept: '.pcap,.pcapng,.cap,.log,.txt',
    label: 'PCAP, PCAPNG, CAP, LOG network files',
  },
  'Other': {
    extensions: null,
    accept: '*/*',
    label: 'Any binary forensic artifact',
  },
};

function validateSelectedFile(file, category) {
  if (!file) return { valid: true };

  // File size check (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return {
      valid: false,
      message: `File exceeds 10 MB limit (${formatFileSize(file.size)}). Please choose a smaller file.`,
    };
  }

  // Category vs Extension restriction
  const rule = categoryRules[category];
  if (rule && rule.extensions) {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!rule.extensions.includes(ext)) {
      return {
        valid: false,
        message: `❌ Category Mismatch: You cannot upload a "${ext.toUpperCase()}" file under the "${category}" category. Allowed: ${rule.label}. Please select a valid file or switch the category.`,
      };
    }
  }

  return { valid: true };
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(['investigator']);

  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('evidence-file');
  const categorySelect = document.getElementById('evidence-type');
  const submitBtn = document.getElementById('btn-submit-upload');
  const fileNotice = document.getElementById('file-notice');

  function updateCategoryConstraints() {
    const category = categorySelect ? categorySelect.value : 'Document';
    const rule = categoryRules[category];

    // Restrict file dialog accept filter
    if (fileInput && rule && rule.accept) {
      fileInput.accept = rule.accept;
    } else if (fileInput) {
      fileInput.removeAttribute('accept');
    }

    const file = fileInput ? fileInput.files[0] : null;

    if (file) {
      const result = validateSelectedFile(file, category);
      if (!result.valid) {
        fileNotice.innerHTML = `<span style="color: var(--danger); font-weight: 600; display: block; margin-top: 4px;">${result.message}</span>`;
        if (submitBtn) submitBtn.disabled = true;
      } else {
        fileNotice.innerHTML = `<span style="color: var(--success); font-weight: 600; display: block; margin-top: 4px;">✓ Selected: ${escapeHtml(file.name)} (${formatFileSize(file.size)}) — Valid for ${category}</span>`;
        if (submitBtn) submitBtn.disabled = false;
      }
    } else {
      fileNotice.innerHTML = rule
        ? `Allowed formats for <strong>${category}</strong>: ${rule.label}. Maximum file size: 10 MB.`
        : `Allowed formats: PDF, JPG, PNG, TXT, DOCX, LOG. Maximum file size: 10 MB.`;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', updateCategoryConstraints);
    updateCategoryConstraints();
  }

  if (fileInput) {
    fileInput.addEventListener('change', updateCategoryConstraints);
  }

  // Handle form submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('evidence-title').value.trim();
      const caseNumber = document.getElementById('case-number').value.trim();
      const evidenceType = categorySelect ? categorySelect.value : 'Document';
      const description = document.getElementById('evidence-description').value.trim();
      const notes = document.getElementById('evidence-notes').value.trim();
      const file = fileInput.files[0];

      if (!file) {
        showToast('Please select an evidence file to upload.', 'warning');
        return;
      }

      // Final strict client check
      const validation = validateSelectedFile(file, evidenceType);
      if (!validation.valid) {
        showToast(validation.message, 'error');
        if (submitBtn) submitBtn.disabled = true;
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
