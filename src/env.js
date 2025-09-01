// This file will be replaced with actual environment variables during deployment

(function(window) {
  window.env = window.env || {};
  
  // Helper function to get environment variable or default
  function getEnvVar(templateValue, defaultValue) {
    // If template wasn't replaced (contains ${...}), use default
    if (templateValue.includes('${') && templateValue.includes('}')) {
      return defaultValue;
    }
    // If it was replaced, use the actual value
    return templateValue;
  }
  
  // Environment variables - these will be injected during build/deployment
  window.env.ADMIN_PASSWORD = getEnvVar('${ADMIN_PASSWORD}', 'admin123');
  
  // OAuth configuration for debugging/development
  window.env.GOOGLE_OAUTH_CLIENT_ID = getEnvVar('${GOOGLE_OAUTH_CLIENT_ID}', 'y167606969733-lveese0cgih4gk8pechh89tj8oug76fi.apps.googleusercontent.com');
  window.env.ADMIN_EMAILS = getEnvVar('${ADMIN_EMAILS}', 'zamanadeeb789@gmail.com,Sayed.jafri@gmail.com');
  
  console.log('[env.js] Environment configured:', {
    hasOAuthClientId: !!window.env.GOOGLE_OAUTH_CLIENT_ID,
    adminEmails: window.env.ADMIN_EMAILS,
    isDebugMode: window.env.GOOGLE_OAUTH_CLIENT_ID === 'debug-client-id',
    clientId: window.env.GOOGLE_OAUTH_CLIENT_ID
  });
})(this);
