/**
 * P.R.A.M.A.N — Authentication & Role-Based Navigation Controller
 */

function getToken() {
  return localStorage.getItem('praman_token');
}

function getUser() {
  const userJson = localStorage.getItem('praman_user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
}

function isAuthenticated() {
  return !!getToken();
}

// Guard page access
function requireAuth(allowedRoles = []) {
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }

  const user = getUser();
  const currentFile = window.location.pathname.split('/').pop();

  if (user && user.role === 'court_officer' && (currentFile === 'dashboard.html' || currentFile === '')) {
    window.location.href = 'court-dashboard.html';
    return;
  }

  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    alert(`Access Denied: '${user.role}' role is not authorized to view this page.`);
    if (user.role === 'court_officer') {
      window.location.href = 'court-dashboard.html';
    } else {
      window.location.href = 'dashboard.html';
    }
  }
}

// Log out handler
async function handleLogout() {
  try {
    await api.post('/auth/logout', {});
  } catch (e) {
    // proceed regardless
  } finally {
    localStorage.removeItem('praman_token');
    localStorage.removeItem('praman_user');
    window.location.href = 'index.html';
  }
}

// Initialize navigation UI & role filtering
function initNavigation() {
  const user = getUser();
  if (!user) return;

  // Set user details in sidebar
  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');

  if (userNameEl) userNameEl.textContent = user.name;
  // Format user role display
  if (userRoleEl) {
    userRoleEl.textContent = user.role.replace('_', ' ').toUpperCase();
  }

  // Role-based navigation visibility
  // Admin: full access
  // Investigator: dashboard, evidence, upload, custody
  // Forensic: dashboard, evidence, custody
  // Court Officer: court dashboard, court evidence, court review, custody, court reports, court activity
  const navUpload = document.getElementById('nav-upload');
  const navAudit = document.getElementById('nav-audit');
  const navUsers = document.getElementById('nav-users');
  const courtNavSection = document.querySelectorAll('.court-nav-item');
  const standardNavSection = document.querySelectorAll('.standard-nav-item');

  if (user.role === 'court_officer') {
    if (navUpload) navUpload.style.display = 'none';
    if (navAudit) navAudit.style.display = 'none';
    if (navUsers) navUsers.style.display = 'none';
    standardNavSection.forEach((el) => (el.style.display = 'none'));
    courtNavSection.forEach((el) => (el.style.display = 'flex'));
  } else {
    // Non-court officers don't see court-specific nav items unless admin
    if (user.role !== 'admin') {
      courtNavSection.forEach((el) => (el.style.display = 'none'));
    }
    if (user.role === 'forensic') {
      if (navUpload) navUpload.style.display = 'none';
      if (navAudit) navAudit.style.display = 'none';
      if (navUsers) navUsers.style.display = 'none';
    } else if (user.role === 'investigator') {
      if (navAudit) navAudit.style.display = 'none';
      if (navUsers) navUsers.style.display = 'none';
    }
  }

  const adminTitle = document.getElementById('admin-section-title');
  if (adminTitle && user.role !== 'admin') {
    adminTitle.style.display = 'none';
  }

  // Highlight active link based on pathname
  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'dashboard.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Setup logout button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Mobile menu toggle
  const toggleBtn = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

// Run navigation initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    initNavigation();
  }
});
