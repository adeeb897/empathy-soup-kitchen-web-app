// This file will be replaced with actual environment variables during deployment

(function(window) {
  window.env = window.env || {};
  // Environment variables - ADMIN_PASSWORD will be injected during build/deployment
  window.env.ADMIN_PASSWORD = '${ADMIN_PASSWORD}' || 'admin123'; // Default for development
})(this);
