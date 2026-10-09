/**
 * P.R.A.M.A.N — Evidence Directory & Search Controller
 */

let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();

  const user = getUser();
  const topActionBtn = document.querySelector('.top-bar-actions a');
  if (topActionBtn && user && user.role === 'forensic') {
    topActionBtn.style.display = 'none';
  }

  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('filter-status');
  const typeFilter = document.getElementById('filter-type');
  const caseFilter = document.getElementById('filter-case');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  // Load evidence
  loadEvidence();

  // Search and filter listeners
  let debounceTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentPage = 1;
        loadEvidence();
      }, 350);
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', () => { currentPage = 1; loadEvidence(); });
  if (typeFilter) typeFilter.addEventListener('change', () => { currentPage = 1; loadEvidence(); });
  if (caseFilter) {
    caseFilter.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentPage = 1;
        loadEvidence();
      }, 350);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadEvidence();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentPage++;
      loadEvidence();
    });
  }
});

async function loadEvidence() {
  const tbody = document.getElementById('evidence-tbody');
  const pageInfo = document.getElementById('pagination-info');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  const search = document.getElementById('search-input')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const type = document.getElementById('filter-type')?.value || '';
  const caseNumber = document.getElementById('filter-case')?.value || '';

  const params = new URLSearchParams({
    page: currentPage,
    limit,
    ...(search && { search }),
    ...(status && { status }),
    ...(type && { type }),
    ...(caseNumber && { caseNumber }),
  });

  try {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-secondary);">Loading evidence records...</td></tr>`;

    const res = await api.get(`/evidence?${params.toString()}`);
    if (!res || !res.data) return;

    const { data: list, total, page, pages } = res;

    if (pageInfo) {
      pageInfo.textContent = `Showing page ${page} of ${pages} (${total} total records)`;
    }

    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= pages;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-secondary);">No evidence matching query criteria found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((ev) => {
        const integrityBadge =
          ev.integrityStatus === 'Verified'
            ? '<span class="badge badge-success">Verified</span>'
            : ev.integrityStatus === 'Failed'
            ? '<span class="badge badge-danger">Failed</span>'
            : '<span class="badge badge-warning">Not Checked</span>';

        const holderName = ev.currentHolder ? ev.currentHolder.name : 'Unknown';

        return `
          <tr>
            <td class="mono" style="font-weight: 700; color: var(--accent); white-space: nowrap;">
              <a href="evidence-details.html?id=${ev._id}">${ev.evidenceId}</a>
            </td>
            <td><strong>${escapeHtml(ev.title)}</strong></td>
            <td><span class="badge badge-secondary">${escapeHtml(ev.caseNumber)}</span></td>
            <td>${ev.evidenceType}</td>
            <td>${escapeHtml(holderName)}</td>
            <td><span class="badge badge-info">${ev.status}</span></td>
            <td id="integrity-cell-${ev._id}">${integrityBadge}</td>
            <td style="color: var(--text-secondary); white-space: nowrap;">${formatDate(ev.createdAt)}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <a href="evidence-details.html?id=${ev._id}" class="btn btn-secondary btn-sm" title="View Details">View</a>
                <button onclick="quickVerify('${ev._id}', this)" class="btn btn-primary btn-sm" title="Verify Integrity">Verify</button>
                <a href="custody.html?evidenceId=${ev._id}" class="btn btn-secondary btn-sm" title="Chain of Custody">Custody</a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    showToast(`Failed to fetch evidence list: ${err.message}`, 'error');
  }
}

// Quick inline verification action from table
async function quickVerify(evidenceId, btnElement) {
  const originalText = btnElement.textContent;
  btnElement.disabled = true;
  btnElement.textContent = 'Checking...';

  try {
    const res = await api.post(`/evidence/${evidenceId}/verify`, {});
    const { isMatch } = res.data;

    const cell = document.getElementById(`integrity-cell-${evidenceId}`);
    if (cell) {
      cell.innerHTML = isMatch
        ? '<span class="badge badge-success">Verified</span>'
        : '<span class="badge badge-danger">Failed</span>';
    }

    if (isMatch) {
      showToast('Integrity Confirmed: SHA-256 matches reference hash!', 'success');
    } else {
      showToast('CRITICAL: SHA-256 hash mismatch! Evidence may have been altered.', 'error');
    }
  } catch (err) {
    showToast(`Verification failed: ${err.message}`, 'error');
  } finally {
    btnElement.disabled = false;
    btnElement.textContent = originalText;
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
