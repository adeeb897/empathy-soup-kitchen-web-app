// This file will be replaced with actual environment variables during deployment

(function(window) {
  window.env = window.env || {};
  // Environment variables - these will be injected during build/deployment
  window.env.ADMIN_PASSWORD = '${ADMIN_PASSWORD}' || 'admin123'; // Default for development
  
  // OAuth configuration for debugging/development
  window.env.GOOGLE_OAUTH_CLIENT_ID = '${GOOGLE_OAUTH_CLIENT_ID}' || 'debug-client-id';
  window.env.ADMIN_EMAILS = '${ADMIN_EMAILS}' || 'test@gmail.com,admin@gmail.com';
  
  console.log('[env.js] Environment configured:', {
    hasOAuthClientId: !!window.env.GOOGLE_OAUTH_CLIENT_ID,
    adminEmails: window.env.ADMIN_EMAILS,
    isDebugMode: window.env.GOOGLE_OAUTH_CLIENT_ID === 'debug-client-id'
  });
})(this);
