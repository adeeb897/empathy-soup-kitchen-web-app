# Gmail OAuth2 Authentication Setup Guide

This guide explains how to configure Gmail OAuth2 authentication for the admin panel access.

## Overview

The application now uses OAuth2 with Gmail as the authentication provider instead of the previous plaintext password system. This provides:

- **Enhanced Security**: No more plaintext passwords
- **Centralized Identity**: Uses Google accounts for authentication
- **Admin Control**: Configurable list of authorized admin emails
- **Session Management**: Secure token handling with automatic refresh
- **Audit Trail**: Logging of authentication events

## Architecture

```
User → Angular App → Google OAuth → Azure Functions → Admin Panel
```

### Key Components

1. **Frontend Services**:
   - `GoogleOAuthService`: Handles OAuth flow with PKCE
   - `TokenService`: Manages tokens and refresh logic
   - `AdminOAuthService`: Main authentication orchestrator

2. **Azure Functions**:
   - `/api/auth/token`: Exchange authorization code for tokens
   - `/api/auth/refresh`: Refresh expired access tokens
   - `/api/auth/validate-admin`: Validate admin permissions
   - `/api/auth/logout`: Handle logout and token revocation

3. **Security Features**:
   - PKCE (Proof Key for Code Exchange)
   - State parameter for CSRF protection
   - HttpOnly cookies for refresh tokens
   - Memory-only storage for access tokens

## Setup Instructions

### Step 1: Google OAuth Configuration

1. **Create Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project or create a new one
   - Enable the "Google+ API" (for user profile access)
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"

2. **Configure Redirect URIs**:
   ```
   Production: https://yourdomain.com/calendar/admin
   Development: http://localhost:4200/calendar/admin
   ```

3. **Note your credentials**:
   - Client ID (starts with numbers, ends with .apps.googleusercontent.com)
   - Client Secret (random string)

### Step 2: Azure Configuration

Add these environment variables to your Azure Function App settings:

```bash
# OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_OAUTH_CLIENT_SECRET="your-client-secret"
GOOGLE_OAUTH_REDIRECT_URI="https://yourdomain.com/calendar/admin"

# Admin Access Control
ADMIN_EMAILS="admin1@gmail.com,admin2@gmail.com,admin3@gmail.com"
```

### Step 3: Frontend Configuration

Add configuration to your deployment:

#### Option 1: Environment Variables (Recommended)
Set these variables in your Azure Static Web App configuration:

```bash
# Frontend OAuth Configuration
GOOGLE_OAUTH_CLIENT_ID="your-client-id.apps.googleusercontent.com"
ADMIN_EMAILS="admin1@gmail.com,admin2@gmail.com,admin3@gmail.com"
```

#### Option 2: Runtime Configuration
Create a global configuration object accessible to the Angular app:

```javascript
// In your index.html or a configuration script
window.OAUTH_CONFIG = {
  clientId: 'your-client-id.apps.googleusercontent.com',
  redirectUri: 'https://yourdomain.com/calendar/admin',
  scope: 'openid email profile',
  adminEmails: ['admin1@gmail.com', 'admin2@gmail.com']
};
```

#### Option 3: Environment File Pattern (Recommended)
The application uses `src/env.js` with template variable replacement:

```javascript
// In src/env.js - Template variables get replaced during deployment
(function(window) {
  window.env = window.env || {};
  
  // Helper function to get environment variable or default
  function getEnvVar(templateValue, defaultValue) {
    if (templateValue.includes('${') && templateValue.includes('}')) {
      return defaultValue;
    }
    return templateValue;
  }
  
  // Environment variables - these will be injected during build/deployment
  window.env.GOOGLE_OAUTH_CLIENT_ID = getEnvVar('${GOOGLE_OAUTH_CLIENT_ID}', 'debug-client-id');
  window.env.ADMIN_EMAILS = getEnvVar('${ADMIN_EMAILS}', 'test@gmail.com,admin@gmail.com');
})(this);
```

**Note:** Ensure `env.js` is included in your Angular build by adding it to `angular.json`:
```json
"assets": [
  {
    "glob": "**/*",
    "input": "assets",
    "output": "/assets/"
  },
  {
    "glob": "env.js",
    "input": "src",
    "output": "/"
  }
]
```

### Step 4: Azure Static Web App Routing

Update your `staticwebapp.config.json` to handle OAuth redirects:

```json
{
  "routes": [
    {
      "route": "/calendar/admin*",
      "rewrite": "/index.html"
    }
  ]
}
```

### Step 5: CORS Configuration

Ensure your Azure Functions allow requests from your frontend domain:

```json
{
  "version": "2.0",
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[2.*, 3.0.0)"
  },
  "functionTimeout": "00:05:00",
  "host": {
    "cors": {
      "allowedOrigins": [
        "https://yourdomain.com",
        "http://localhost:4200"
      ],
      "supportCredentials": true
    }
  }
}
```

## Testing the Setup

### 1. Development Testing

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Configure local environment**:
   ```bash
   # In browser console or localStorage
   localStorage.setItem('OAUTH_GOOGLE_OAUTH_CLIENT_ID', 'your-dev-client-id');
   localStorage.setItem('OAUTH_ADMIN_EMAILS', 'your-email@gmail.com');
   ```

3. **Test OAuth flow**:
   - Navigate to `http://localhost:4200/calendar`
   - Add query parameter: `?adminLogin=true`
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify redirect to admin panel

### 2. Production Testing

1. **Deploy to Azure Static Web Apps**
2. **Configure production environment variables**
3. **Test full OAuth flow**:
   - Visit your production URL
   - Attempt admin login
   - Verify authentication and admin access
   - Test logout functionality

## Security Considerations

### Token Storage
- **Access Tokens**: Stored in memory only (lost on page refresh)
- **Refresh Tokens**: Stored in httpOnly cookies (secure, not accessible via JavaScript)
- **Session State**: Minimal UI state in sessionStorage

### PKCE Implementation
- Uses SHA256 code challenge method
- 128-character cryptographically secure code verifier
- Prevents authorization code interception attacks

### Admin Access Control
- Server-side email validation
- Real-time admin list checking on each token refresh
- Audit logging of authentication events

### Network Security
- HTTPS-only in production
- Secure cookie attributes (HttpOnly, Secure, SameSite)
- CORS properly configured

## Troubleshooting

### Common Issues

1. **"OAuth configuration missing" error**:
   - Verify environment variables are set in Azure
   - Check variable names match exactly
   - Ensure no trailing spaces in email lists

2. **"Access denied" error**:
   - Verify your Gmail address is in ADMIN_EMAILS list
   - Check for typos in email addresses
   - Ensure emails are comma-separated with no spaces

3. **"Invalid redirect URI" error**:
   - Verify redirect URI in Google Console matches your domain
   - Check for http vs https mismatch
   - Ensure URI includes the full path: `/calendar/admin`

4. **Token refresh fails**:
   - Check that refresh tokens are being stored properly
   - Verify CORS allows credentials
   - Ensure Azure Function has proper cookie handling

### Debug Mode

Enable debug logging by adding to your Azure Function settings:
```bash
WEBSITE_NODE_DEFAULT_VERSION="~18"
FUNCTIONS_EXTENSION_VERSION="~4"
AzureWebJobsStorage="your-storage-connection"
FUNCTIONS_WORKER_RUNTIME="node"
```

### Local Development

For local development, you can use the Azure Functions Core Tools:

```bash
# In the /api directory
npm install
func start

# In the root directory
npm run dev
```

## Migration from Old System

The old password-based authentication has been completely replaced. The migration is automatic - no data migration is needed since authentication state was stored in sessionStorage only.

### Cleanup

The following files are now obsolete and can be removed:
- `src/app/pages/calendar/services/admin-auth.service.ts` (replaced by `admin-oauth.service.ts`)

### Backward Compatibility

The new system maintains the same external API for components:
- `isAuthenticated$` observable
- `login()` and `logout()` methods
- `isAuthenticated()` synchronous check

## Support

If you encounter issues:

1. Check Azure Function logs in the Azure Portal
2. Use browser developer tools to inspect network requests
3. Verify environment configuration
4. Test with a fresh incognito/private browsing session

The new OAuth system provides robust, secure authentication that scales with your organization's needs while maintaining the same user experience for admin access.