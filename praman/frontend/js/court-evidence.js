/**
 * P.R.A.M.A.N — Court Evidence Catalog Controller
 *
 * @rule COURT_OFFICER_ONLY
 */

let courtPage = 1;
const courtLimit = 10;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(['court_officer', 'admin']);

  const searchInput = document.getElementById('search-court-input');
  const statusFilter = document.getElementById('filter-court-status');
  const caseFilter = document.getElementById('filter-court-case');
  const btnPrev = document.getElementById('btn-court-prev');
  const btnNext = document.getElementById('btn-court-next');

  loadCourtEvidence();

  let debounceTimer;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        courtPage = 1;
        loadCourtEvidence();
      }, 350);
    });
  }

  if (caseFilter) {
    caseFilter.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        courtPage = 1;
        loadCourtEvidence();
      }, 350);
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      courtPage = 1;
      loadCourtEvidence();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (courtPage > 1) {
        courtPage--;
        loadCourtEvidence();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      courtPage++;
      loadCourtEvidence();
    });
  }
});

async function loadCourtEvidence() {
  const tbody = document.getElementById('court-evidence-tbody');
  const pageInfo = document.getElementById('court-page-info');
  const btnPrev = document.getElementById('btn-court-prev');
  const btnNext = document.getElementById('btn-court-next');

  const search = document.getElementById('search-court-input')?.value || '';
  const courtStatus = document.getElementById('filter-court-status')?.value || '';
  const caseNumber = document.getElementById('filter-court-case')?.value || '';

  const params = new URLSearchParams({
    page: courtPage,
    limit: courtLimit,
    ...(search && { search }),
    ...(courtStatus && { courtStatus }),
    ...(caseNumber && { caseNumber }),
  });

  try {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-secondary);">Loading authorized court evidence records...</td></tr>`;

    const res = await api.get(`/court/evidence?${params.toString()}`);
    if (!res || !res.data) return;

    const { data: list, total, page, pages } = res;

    if (pageInfo) {
      pageInfo.textContent = `Showing page ${page} of ${pages} (${total} court records)`;
    }

    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= pages;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-secondary);">No court evidence matching search criteria found.</td></tr>`;
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

        const courtBadge = getCourtStatusBadge(ev.courtReviewStatus);

        return `
          <tr>
            <td class="mono" style="font-weight: 700; color: var(--accent); white-space: nowrap;">
              <a href="court-review.html?id=${ev._id}">${ev.evidenceId}</a>
            </td>
            <td><span class="badge badge-secondary mono">${escapeHtml(ev.caseNumber)}</span></td>
            <td><strong>${escapeHtml(ev.title)}</strong></td>
            <td>${ev.evidenceType}</td>
            <td id="court-integrity-${ev._id}">${integrityBadge}</td>
            <td>${courtBadge}</td>
            <td style="color: var(--text-secondary); white-space: nowrap;">${formatDate(ev.updatedAt || ev.createdAt)}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <a href="court-review.html?id=${ev._id}" class="btn btn-primary btn-sm" title="Open Review Dossier">Review</a>
                <button onclick="quickCourtVerify('${ev._id}', this)" class="btn btn-secondary btn-sm" title="Verify SHA-256">Verify</button>
                <a href="custody.html?evidenceId=${ev._id}" class="btn btn-secondary btn-sm" title="View Chain of Custody">Custody</a>
                <a href="court-report.html?id=${ev._id}" class="btn btn-secondary btn-sm" title="Evidence Report">Report</a>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    showToast(`Failed to load court evidence: ${err.message}`, 'error');
  }
}

async function quickCourtVerify(id, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await api.post(`/court/evidence/${id}/verify`, {});
    const cell = document.getElementById(`court-integrity-${id}`);
    if (cell) {
      cell.innerHTML = res.data.isMatch
        ? '<span class="badge badge-success">Verified</span>'
        : '<span class="badge badge-danger">Failed</span>';
    }
    showToast(res.message, res.data.isMatch ? 'success' : 'error');
  } catch (err) {
    showToast(`Verification error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

function getCourtStatusBadge(status) {
  switch (status) {
    case 'Accepted for Court Record':
      return '<span class="badge badge-success">Accepted for Record</span>';
    case 'Pending Court Review':
      return '<span class="badge badge-warning">Pending Review</span>';
    case 'Under Court Review':
      return '<span class="badge badge-info">Under Review</span>';
    case 'Requires Clarification':
      return '<span class="badge badge-danger">Clarification Needed</span>';
    case 'Archived':
      return '<span class="badge badge-secondary">Archived</span>';
    default:
      return '<span class="badge badge-secondary">None</span>';
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
