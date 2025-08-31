# Email Notification Setup Guide

This guide will help you set up email notifications for the Empathy Soup Kitchen volunteer management system.

## 🚀 Quick Start

### 1. Gmail SMTP Setup

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create App-Specific Password**:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Select "Mail" as the app
   - Copy the 16-character password
3. **Configure Environment Variables** (see step 3 below)

### 2. Deploy Azure Functions

The serverless email function needs to be deployed to Azure. You have two options:

#### Option A: Azure Static Web Apps (Recommended)
Your project appears to be configured for Azure SWA, which includes Azure Functions support.

1. **Deploy via GitHub Actions** (if already set up):
   ```bash
   git add .
   git commit -m "Add email notification system"
   git push
   ```

2. **Manual deployment via Azure CLI**:
   ```bash
   # Install Azure CLI if not already installed
   az login
   az staticwebapp deploy --name your-swa-name --resource-group your-resource-group
   ```

#### Option B: Standalone Azure Functions
```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# From the /api directory
cd api
npm install
func azure functionapp publish your-function-app-name
```

### 3. Environment Variables Configuration

Set these environment variables in your Azure portal:

#### Azure Static Web Apps:
1. Go to Azure Portal → Static Web Apps → Your App → Configuration
2. Add these Application Settings:

```
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USERNAME=empathysoupkitchen@gmail.com
EMAIL_SMTP_PASSWORD=[Your App-Specific Password]
EMAIL_SENDER_NAME=Empathy Soup Kitchen
EMAIL_SENDER_EMAIL=noreply@empathysoupkitchen.org
EMAIL_ADMIN_EMAIL=admin@empathysoupkitchen.org
```

#### For Standalone Azure Functions:
1. Go to Azure Portal → Function Apps → Your App → Configuration
2. Add the same Application Settings as above

### 4. DNS Configuration (Recommended)

To improve email deliverability and avoid spam folders:

#### SPF Record
- **Type**: TXT
- **Name**: @
- **Value**: `v=spf1 include:_spf.google.com ~all`

#### DMARC Record
- **Type**: TXT
- **Name**: _dmarc
- **Value**: `v=DMARC1; p=quarantine; rua=mailto:empathysoupkitchen@gmail.com`

### 5. Test the System

1. **Angular Configuration**: Ensure your email config service points to the correct endpoint:
   ```typescript
   // In your environment files
   emailApiEndpoint: '/api/email/send'  // For Azure SWA
   // or
   emailApiEndpoint: 'https://your-function-app.azurewebsites.net/api/email/send'  // For standalone
   ```

2. **Test Email Sending**:
   ```typescript
   // Use the built-in testing functionality
   const result = await this.emailManagementService.testEmailSystem('test@example.com');
   console.log('Test result:', result);
   ```

## 📧 Email Types

The system sends three types of emails:

1. **Volunteer Confirmation** - When someone signs up for a shift
2. **Admin Notifications** - When shifts are created or volunteers sign up
3. **Reminder Emails** - 24 hours before volunteer shifts

## 🔧 Configuration Options

### Email Features
You can enable/disable features via environment variables:
- `EMAIL_ENABLE_NOTIFICATIONS=true/false`
- `EMAIL_ENABLE_REMINDERS=true/false`  
- `EMAIL_ENABLE_ADMIN_NOTIFICATIONS=true/false`

### Reminder Timing
- `EMAIL_REMINDER_HOURS_BEFORE=24` (hours before shift to send reminder)
- `EMAIL_REMINDER_CHECK_INTERVAL=60` (minutes between reminder checks)

## 🚨 Troubleshooting

### Common Issues

1. **"Authentication failed"**
   - Verify you're using an App-Specific Password, not your regular Gmail password
   - Ensure 2FA is enabled on your Gmail account

2. **"Environment variable missing"**
   - Check that all required environment variables are set in Azure
   - Verify the Azure Function has access to the environment variables

3. **"CORS errors"**
   - The Azure Function includes CORS headers
   - Ensure your Angular app is calling the correct endpoint

4. **"Emails going to spam"**
   - Set up SPF and DMARC DNS records
   - Consider using a dedicated email service like SendGrid for better deliverability

### Testing

1. **Local Testing**:
   ```bash
   cd api
   func start
   # Function will run on http://localhost:7071/api/email/send
   ```

2. **Production Testing**:
   - Use the built-in email system testing
   - Check Azure Function logs in the Azure Portal
   - Monitor Application Insights for errors

## 🔒 Security Best Practices

1. **Never commit secrets** to Git
2. **Use App-Specific Passwords** instead of regular Gmail passwords  
3. **Rotate passwords** regularly
4. **Monitor email logs** for suspicious activity
5. **Implement rate limiting** if receiving high volumes

## 📈 Monitoring

Monitor your email system through:
- **Azure Application Insights** - Function performance and errors
- **Angular Console** - Client-side email service logs
- **Gmail Sent folder** - Verify emails are being sent
- **Email delivery reports** - Check bounce rates and deliverability

## 🆘 Support

If you encounter issues:
1. Check the Azure Function logs in the Azure Portal
2. Review the Angular console for client-side errors
3. Verify all environment variables are correctly set
4. Test Gmail SMTP credentials manually if needed

## 💰 Costs

Expected monthly costs for typical non-profit usage:
- **Azure Functions**: ~$0 (generous free tier)
- **Gmail SMTP**: Free (500 emails/day limit)
- **Azure Static Web Apps**: ~$0 (free tier for small sites)

Total estimated cost: **$0-10/month** depending on volume.

---

**Need help?** Check the logs, verify your configuration, and ensure your DNS settings are correct for optimal deliverability.