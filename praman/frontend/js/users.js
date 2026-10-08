/**
 * P.R.A.M.A.N — User Management Controller (Admin Only)
 */

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(['admin']);

  loadUsers();
  setupAddUserModal();
});

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  const countEl = document.getElementById('user-count-badge');

  try {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">Loading user directory...</td></tr>';

    const res = await api.get('/users');
    if (!res || !res.data) return;

    const users = res.data;
    if (countEl) countEl.textContent = `${users.length} Total Users`;

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-secondary);">No users registered.</td></tr>';
      return;
    }

    const currentAdmin = getUser();

    tbody.innerHTML = users
      .map((u) => {
        const isSelf = u._id === currentAdmin.id;
        const statusBadge = u.isActive
          ? '<span class="badge badge-success">Active</span>'
          : '<span class="badge badge-danger">Deactivated</span>';

        const actionBtn = isSelf
          ? '<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">Current Session</span>'
          : `
            <button onclick="toggleUser('${u._id}', ${u.isActive})" class="btn ${u.isActive ? 'btn-danger' : 'btn-success'} btn-sm">
              ${u.isActive ? 'Deactivate' : 'Activate'}
            </button>
          `;

        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${escapeHtml(u.name)}</div>
            </td>
            <td class="mono" style="font-size: 13px;">${escapeHtml(u.email)}</td>
            <td><span class="badge badge-info">${u.role.toUpperCase()}</span></td>
            <td>${statusBadge}</td>
            <td style="color: var(--text-secondary);">${formatDate(u.createdAt)}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    showToast(`Failed to load users: ${err.message}`, 'error');
  }
}

async function toggleUser(userId, currentActive) {
  const actionName = currentActive ? 'deactivate' : 'activate';
  if (!confirm(`Are you sure you want to ${actionName} this user account?`)) return;

  try {
    const res = await api.patch(`/users/${userId}/status`, {});
    showToast(res.message, 'success');
    loadUsers();
  } catch (err) {
    showToast(`Failed to update status: ${err.message}`, 'error');
  }
}

function setupAddUserModal() {
  const modal = document.getElementById('modal-add-user');
  const openBtn = document.getElementById('btn-open-add-user');
  const closeBtn = document.getElementById('btn-close-add-user');
  const cancelBtn = document.getElementById('btn-cancel-add-user');
  const form = document.getElementById('form-add-user');

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      form.reset();
      modal.classList.add('active');
    });
  }

  const closeModal = () => modal?.classList.remove('active');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('user-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password').value;
      const role = document.getElementById('user-role').value;

      const submitBtn = document.getElementById('btn-submit-user');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        await api.post('/users', { name, email, password, role });
        showToast(`User account created for ${name}!`, 'success');
        closeModal();
        loadUsers();
      } catch (err) {
        showToast(`Error creating user: ${err.message}`, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User Account';
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
