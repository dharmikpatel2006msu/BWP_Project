/**
 * P.R.A.M.A.N — Centralized API Client & Utility
 * Handles token attachment, error responses, toasts, and redirects.
 */

const API_BASE = '/api';

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

// Toast Notification Manager
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// Format Date / Time helper
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format bytes to human readable (KB, MB)
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Core API Request Wrapper
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('praman_token');

  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set Content-Type only if not sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // Handle XML / blob download endpoints
    const contentType = response.headers.get('content-type');
    if (contentType && (contentType.includes('application/xml') || contentType.includes('octet-stream'))) {
      if (!response.ok) {
        throw new Error('Failed to download file');
      }
      return response;
    }

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 && !window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/')) {
        localStorage.removeItem('praman_token');
        localStorage.removeItem('praman_user');
        window.location.href = 'index.html?error=session_expired';
        return;
      }
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// HTTP Helper verbs
const api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) =>
    apiRequest(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: (url, body) =>
    apiRequest(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (url) => apiRequest(url, { method: 'DELETE' }),
};
