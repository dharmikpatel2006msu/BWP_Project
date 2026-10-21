/**
 * P.R.A.M.A.N — Audit Logs & XML Export Controller
 */

let currentAuditPage = 1;
const auditLimit = 15;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(['admin']);

  const actionFilter = document.getElementById('filter-audit-action');
  const btnExportXml = document.getElementById('btn-export-xml');
  const btnPrev = document.getElementById('btn-audit-prev');
  const btnNext = document.getElementById('btn-audit-next');

  loadAuditLogs();

  if (actionFilter) {
    actionFilter.addEventListener('change', () => {
      currentAuditPage = 1;
      loadAuditLogs();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentAuditPage > 1) {
        currentAuditPage--;
        loadAuditLogs();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentAuditPage++;
      loadAuditLogs();
    });
  }

  if (btnExportXml) {
    btnExportXml.addEventListener('click', handleXmlExport);
  }
});

async function loadAuditLogs() {
  const tbody = document.getElementById('audit-tbody');
  const pageInfo = document.getElementById('audit-page-info');
  const btnPrev = document.getElementById('btn-audit-prev');
  const btnNext = document.getElementById('btn-audit-next');
  const action = document.getElementById('filter-audit-action')?.value || '';

  const params = new URLSearchParams({
    page: currentAuditPage,
    limit: auditLimit,
    ...(action && { action }),
  });

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">Loading system audit trail...</td></tr>';

    const res = await api.get(`/audit?${params.toString()}`);
    if (!res || !res.data) return;

    const { data: logs, total, page, pages } = res;

    if (pageInfo) {
      pageInfo.textContent = `Showing page ${page} of ${pages} (${total} total audit records)`;
    }

    if (btnPrev) btnPrev.disabled = page <= 1;
    if (btnNext) btnNext.disabled = page >= pages;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 28px; color: var(--text-secondary);">No audit events matching criteria found.</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .map((log) => {
        const badgeClass = getActionBadgeClass(log.action);
        const evidenceCode = log.evidence ? `<span class="mono" style="color: var(--accent); font-weight: 600;">${log.evidence.evidenceId}</span>` : '<span style="color: var(--text-muted);">N/A</span>';
        const userDisplay = log.user ? `${escapeHtml(log.user.name)} (${log.user.role})` : '<span style="color: var(--text-muted);">System / Anonymous</span>';

        return `
          <tr>
            <td><span class="badge ${badgeClass}">${log.action}</span></td>
            <td>${evidenceCode}</td>
            <td>${userDisplay}</td>
            <td style="font-size: 13px;">${escapeHtml(log.details || '')}</td>
            <td class="mono" style="font-size: 12px; color: var(--text-secondary);">${log.ipAddress || '127.0.0.1'}</td>
            <td class="mono" style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${formatDate(log.timestamp)}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    showToast(`Failed to load audit logs: ${err.message}`, 'error');
  }
}

function getActionBadgeClass(action) {
  if (action.includes('VERIFIED') || action.includes('SUCCESS') || action.includes('ACTIVATED')) {
    return 'badge-success';
  }
  if (action.includes('FAILED') || action.includes('DEACTIVATED')) {
    return 'badge-danger';
  }
  if (action.includes('UPLOADED') || action.includes('CREATED')) {
    return 'badge-info';
  }
  if (action.includes('TRANSFERRED')) {
    return 'badge-warning';
  }
  return 'badge-secondary';
}

async function handleXmlExport() {
  const btn = document.getElementById('btn-export-xml');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating XML...';

  try {
    const response = await api.get('/audit/export/xml');
    const blob = await response.blob();

    // Trigger download
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `praman-audit-logs-${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast('XML audit trail downloaded successfully!', 'success');
  } catch (err) {
    showToast(`Failed to export XML: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
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
