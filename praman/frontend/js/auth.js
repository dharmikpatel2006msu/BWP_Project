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
  const token = getToken();
  const user = getUser();
  return !!(token && user);
}

// 1. Instant security check when script executes
(function checkImmediateAuth() {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const isPublic = currentFile === 'index.html' || currentFile === '' || currentFile === 'contribution-report.html';
  if (!isPublic && !isAuthenticated()) {
    if (document.documentElement) {
      document.documentElement.innerHTML = '';
    }
    window.location.replace('index.html');
  }
})();

// 2. Back-Forward Cache (bfcache) Guard — fires when user presses browser Back/Forward buttons
window.addEventListener('pageshow', function (event) {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const isPublic = currentFile === 'index.html' || currentFile === '' || currentFile === 'contribution-report.html';
  if (!isPublic) {
    if (!isAuthenticated()) {
      if (document.documentElement) {
        document.documentElement.innerHTML = '';
      }
      window.location.replace('index.html');
      return;
    }
  }
});

// Guard page access based on user role
function requireAuth(allowedRoles = []) {
  if (!isAuthenticated()) {
    if (document.documentElement) {
      document.documentElement.innerHTML = '';
    }
    window.location.replace('index.html');
    return;
  }

  const user = getUser();
  if (!user) {
    if (document.documentElement) {
      document.documentElement.innerHTML = '';
    }
    window.location.replace('index.html');
    return;
  }

  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  // 1. Court Officer Routing & Protection
  if (user.role === 'court_officer') {
    const courtAllowedPages = [
      'court-dashboard.html',
      'court-evidence.html',
      'court-review.html',
      'court-report.html',
      'court-activity.html',
      'custody.html',
      'evidence-details.html',
    ];
    if (!courtAllowedPages.includes(currentFile) && currentFile !== '') {
      window.location.replace('court-dashboard.html');
      return;
    }
  }

  // 2. Non-Court Roles Blocked from Court Pages (Except Admin)
  if (user.role !== 'court_officer' && user.role !== 'admin' && currentFile.startsWith('court-')) {
    window.location.replace('dashboard.html');
    return;
  }

  // 3. Investigator Role Protection
  if (user.role === 'investigator') {
    const invAllowedPages = ['dashboard.html', 'evidence.html', 'upload.html', 'custody.html', 'evidence-details.html', ''];
    if (!invAllowedPages.includes(currentFile)) {
      alert(`Access Denied: 'Investigator' role is not authorized to access ${currentFile}`);
      window.location.replace('dashboard.html');
      return;
    }
  }

  // 4. Forensic Expert Role Protection
  if (user.role === 'forensic') {
    const forensicAllowedPages = ['dashboard.html', 'evidence.html', 'custody.html', 'evidence-details.html', 'audit.html', ''];
    if (!forensicAllowedPages.includes(currentFile)) {
      alert(`Access Denied: 'Forensic Expert' role is not authorized to access ${currentFile}`);
      window.location.replace('dashboard.html');
      return;
    }
  }

  // 5. System Admin Role Protection (Observer only: zero access to evidence ingestion)
  if (user.role === 'admin' && currentFile === 'upload.html') {
    alert(`Access Denied: System Admin is an observer for governance and cannot ingest or upload evidence files.`);
    window.location.replace('dashboard.html');
    return;
  }

  // Explicit allowedRoles check if passed
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    alert(`Access Denied: '${user.role}' role is not authorized to view this page.`);
    if (user.role === 'court_officer') {
      window.location.replace('court-dashboard.html');
    } else {
      window.location.replace('dashboard.html');
    }
  }
}

// Log out handler
async function handleLogout() {
  try {
    if (typeof api !== 'undefined') {
      await api.post('/auth/logout', {});
    }
  } catch (e) {
    // ignore network error on logout
  } finally {
    localStorage.removeItem('praman_token');
    localStorage.removeItem('praman_user');
    sessionStorage.clear();
    // Use replace to overwrite browser history so clicking Back cannot navigate into protected pages
    window.location.replace('index.html');
  }
}

// Initialize navigation UI & role filtering dynamically
function initNavigation() {
  const user = getUser();
  if (!user) return;

  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
  const sidebarNav = document.querySelector('.sidebar-nav');
  const sidebarHeader = document.querySelector('.sidebar-header');

  if (user.role === 'court_officer') {
    // Judicial Chamber Navigation Sidebar
    if (sidebarHeader) {
      sidebarHeader.innerHTML = `
        <span class="brand-badge" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">JUDICIAL CHAMBER</span>
        <div class="sidebar-title">
          <span>⚖️</span> P.R.A.M.A.N
        </div>
        <div class="sidebar-subtitle">Court Evidence Admissibility & Verification Node</div>
      `;
    }

    if (sidebarNav) {
      sidebarNav.innerHTML = `
        <div class="nav-section-title">Judicial Proceedings</div>
        <a href="court-dashboard.html" class="nav-item ${currentPath === 'court-dashboard.html' ? 'active' : ''}">
          <span class="nav-icon">⚖️</span>
          <span>Court Dashboard</span>
        </a>
        <a href="court-evidence.html" class="nav-item ${currentPath === 'court-evidence.html' ? 'active' : ''}">
          <span class="nav-icon">📜</span>
          <span>Court Evidence</span>
        </a>
        <a href="court-review.html" class="nav-item ${currentPath === 'court-review.html' ? 'active' : ''}">
          <span class="nav-icon">🔍</span>
          <span>Court Review</span>
        </a>
        <a href="custody.html" class="nav-item ${currentPath === 'custody.html' ? 'active' : ''}">
          <span class="nav-icon">⛓️</span>
          <span>Chain of Custody</span>
        </a>
        <a href="court-report.html" class="nav-item ${currentPath === 'court-report.html' ? 'active' : ''}">
          <span class="nav-icon">🖨️</span>
          <span>Court Reports</span>
        </a>
        <a href="court-activity.html" class="nav-item ${currentPath === 'court-activity.html' ? 'active' : ''}">
          <span class="nav-icon">⚡</span>
          <span>Court Activity</span>
        </a>
      `;
    }
  } else {
    // Non-Court Roles Navigation (Admin, Investigator, Forensic Expert)
    if (sidebarHeader) {
      const badgeText =
        user.role === 'admin'
          ? 'SYSTEM ADMIN'
          : user.role === 'forensic'
          ? 'FORENSIC LAB'
          : 'INVESTIGATION UNIT';
      sidebarHeader.innerHTML = `
        <span class="brand-badge">${badgeText}</span>
        <div class="sidebar-title">
          <span>🛡️</span> P.R.A.M.A.N
        </div>
        <div class="sidebar-subtitle">Portal for Recording and Managing Authentic Nodes</div>
      `;
    }

    if (sidebarNav) {
      let navHtml = `
        <div class="nav-section-title">Evidence Workspace</div>
        <a href="dashboard.html" class="nav-item ${currentPath === 'dashboard.html' || currentPath === '' ? 'active' : ''}">
          <span class="nav-icon">📊</span>
          <span>Dashboard</span>
        </a>
        <a href="evidence.html" class="nav-item ${currentPath === 'evidence.html' ? 'active' : ''}">
          <span class="nav-icon">📁</span>
          <span>Evidence Vault</span>
        </a>
      `;

      // Upload link: Investigator ONLY
      if (user.role === 'investigator') {
        navHtml += `
          <a href="upload.html" id="nav-upload" class="nav-item ${currentPath === 'upload.html' ? 'active' : ''}">
            <span class="nav-icon">📤</span>
            <span>Upload Evidence</span>
          </a>
        `;
      }

      // Chain of Custody: Admin, Investigator, Forensic
      navHtml += `
        <a href="custody.html" class="nav-item ${currentPath === 'custody.html' ? 'active' : ''}">
          <span class="nav-icon">⛓️</span>
          <span>Chain of Custody</span>
        </a>
      `;

      // Forensic Audit section: Forensic Lab
      if (user.role === 'forensic') {
        navHtml += `
          <div class="nav-section-title">Forensic Audit</div>
          <a href="audit.html" id="nav-audit" class="nav-item ${currentPath === 'audit.html' ? 'active' : ''}">
            <span class="nav-icon">📜</span>
            <span>Audit Logs</span>
          </a>
        `;
      }

      // Administration section: Admin ONLY
      if (user.role === 'admin') {
        navHtml += `
          <div class="nav-section-title">Administration</div>
          <a href="audit.html" id="nav-audit" class="nav-item ${currentPath === 'audit.html' ? 'active' : ''}">
            <span class="nav-icon">📜</span>
            <span>Audit Logs</span>
          </a>
          <a href="users.html" id="nav-users" class="nav-item ${currentPath === 'users.html' ? 'active' : ''}">
            <span class="nav-icon">👥</span>
            <span>User Management</span>
          </a>
        `;
      }

      sidebarNav.innerHTML = navHtml;
    }
  }

  // User Profile in Footer
  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');

  if (userNameEl) userNameEl.textContent = user.name;
  if (userRoleEl) userRoleEl.textContent = user.role.replace('_', ' ').toUpperCase();
  if (userAvatarEl) {
    const initials = user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    userAvatarEl.textContent = initials || 'US';
  }

  // Logout Button Listener
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      handleLogout();
    };
  }

  // Mobile menu toggle
  const toggleBtn = document.getElementById('mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('open');
    };
  }
}

// Run navigation initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
    initNavigation();
  }
});
