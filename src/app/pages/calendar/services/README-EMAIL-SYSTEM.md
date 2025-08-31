# Email Notification System for Volunteer Shift Management

This document describes the comprehensive email notification system implemented for the Empathy Soup Kitchen volunteer shift management application.

## Overview

The email notification system provides automated email communications for volunteer shift management, including:
- **Confirmation emails** to volunteers when they sign up for shifts
- **Admin notifications** when shifts are created or when volunteers sign up
- **Reminder emails** sent 24 hours (configurable) before volunteer shifts

## Architecture

### Core Services

#### 1. EmailService (`email.service.ts`)
The main service responsible for sending emails. Provides methods for:
- `sendShiftSignupConfirmation()` - Sends confirmation to volunteers
- `sendShiftCreationNotification()` - Notifies admins of new shifts
- `sendShiftSignupAdminNotification()` - Notifies admins of new signups
- `sendShiftReminder()` - Sends reminder emails to volunteers

#### 2. EmailConfigService (`email-config.service.ts`)
Manages configuration for the email system including:
- SMTP settings
- Sender information (name, email addresses)
- Feature flags (enable/disable different email types)
- Reminder timing configuration

#### 3. EmailLoggerService (`email-logger.service.ts`)
Provides comprehensive logging and monitoring:
- Email send success/failure tracking
- System health monitoring
- Error reporting and metrics
- Log export functionality

#### 4. ReminderService (`reminder.service.ts`)
Handles automated reminder scheduling:
- Generates reminder schedules for all signups
- Processes and sends reminders at configured intervals
- Manages reminder lifecycle (creation, cancellation, cleanup)

#### 5. EmailManagementService (`email-management.service.ts`)
Central orchestration service that:
- Initializes the entire email system
- Provides system status and health checks
- Handles configuration updates
- Performs system maintenance

## Integration

### Automatic Integration

The email system is automatically integrated with the `VolunteerShiftService`:

- **Shift Creation**: When a new shift is created, admins receive notifications
- **Volunteer Signup**: When someone signs up, they receive confirmation and admins are notified
- **Reminder Scheduling**: Reminders are automatically scheduled when signups are created
- **Cleanup**: Reminders are removed when shifts or signups are deleted

### Manual Usage

You can also use the services directly:

```typescript
// Inject the services
constructor(
  private emailService: EmailService,
  private reminderService: ReminderService,
  private emailManagement: EmailManagementService
) {}

// Send a manual email
await this.emailService.sendShiftSignupConfirmation(shift, signup);

// Get system status
const status = this.emailManagement.getSystemStatus();

// Test the email system
const testResult = await this.emailManagement.testEmailSystem('test@example.com');
```

## Configuration

### Environment Variables

The system can be configured through environment variables or localStorage (for development):

```javascript
// Email server configuration
EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USERNAME=your_username
EMAIL_SMTP_PASSWORD=your_password

// Sender configuration
EMAIL_SENDER_NAME=Empathy Soup Kitchen
EMAIL_SENDER_EMAIL=noreply@empathy-soup-kitchen.org
EMAIL_ADMIN_EMAIL=admin@empathy-soup-kitchen.org

// API configuration
EMAIL_API_ENDPOINT=/api/email/send

// Feature flags
EMAIL_ENABLE_NOTIFICATIONS=true
EMAIL_ENABLE_REMINDERS=true
EMAIL_ENABLE_ADMIN_NOTIFICATIONS=true

// Reminder configuration
EMAIL_REMINDER_HOURS_BEFORE=24
EMAIL_REMINDER_CHECK_INTERVAL=60
```

### Runtime Configuration

You can also update configuration at runtime:

```typescript
// Update configuration
this.emailManagement.updateConfiguration({
  features: {
    enableReminders: false
  },
  reminders: {
    hoursBeforeShift: 48,
    checkIntervalMinutes: 30
  }
});
```

## Email Templates

The system includes professionally designed, responsive HTML email templates:

### 1. Signup Confirmation Email
- **Purpose**: Confirms volunteer signup and provides shift details
- **Recipient**: Volunteer who signed up
- **Content**: Shift details, what to expect, what to bring, contact information

### 2. Shift Creation Notification
- **Purpose**: Notifies admins when new shifts are created
- **Recipient**: Admin email address
- **Content**: Shift details, preparation checklist

### 3. Signup Admin Notification
- **Purpose**: Notifies admins when volunteers sign up
- **Recipient**: Admin email address
- **Content**: Volunteer details, shift information, capacity status

### 4. Reminder Email
- **Purpose**: Reminds volunteers about upcoming shifts
- **Recipient**: Volunteer who signed up
- **Content**: Shift reminder, pre-shift checklist, contact information

All templates are:
- **Responsive**: Work well on desktop and mobile devices
- **Professional**: Clean, branded design
- **Accessible**: Good contrast and readable fonts
- **Informative**: Include all necessary details

## Monitoring and Logging

### System Health

Check system health:

```typescript
const health = this.emailLoggerService.getHealthStatus();
// Returns: { status: 'healthy' | 'warning' | 'error', details: {...} }
```

### Metrics

Get email metrics:

```typescript
const metrics = this.emailLoggerService.getMetrics();
// Returns detailed metrics about emails sent, failed, etc.
```

### Logs

Retrieve logs for troubleshooting:

```typescript
// Get recent logs
const recentLogs = this.emailManagement.getLogs({ count: 50 });

// Get error logs only
const errorLogs = this.emailManagement.getLogs({ level: 'ERROR' });

// Get logs for specific component
const emailLogs = this.emailManagement.getLogs({ component: 'EmailService' });
```

### Export Data

Export system data for analysis:

```typescript
// Export as JSON
const jsonExport = this.emailManagement.exportData('json');

// Export as CSV
const csvExport = this.emailManagement.exportData('csv');
```

## Error Handling

The system implements comprehensive error handling:

1. **Non-blocking**: Email failures don't prevent shift creation or signup
2. **Retry Logic**: Automatic retry for transient failures
3. **Fallback**: Graceful degradation when email service is unavailable
4. **Logging**: All errors are logged with context for troubleshooting

## Development and Testing

### Development Setup

For local development, you can use localStorage to configure the system:

```typescript
// Set development configuration
this.emailConfigService.setDevelopmentConfig({
  sender: {
    adminEmail: 'admin@localhost'
  },
  endpoints: {
    sendEmail: '/mock-api/email/send'
  }
});
```

### Testing

Test the email system:

```typescript
// Comprehensive system test
const testResult = await this.emailManagement.testEmailSystem('your-email@example.com');
console.log('System test:', testResult);

// Test individual components
const configStatus = this.emailConfigService.getConfigStatus();
const reminderStats = this.reminderService.getStatistics();
```

## Deployment Considerations

### Production Setup

1. **Email Server**: Configure a reliable SMTP server or email service
2. **Environment Variables**: Set all required configuration via environment variables
3. **Monitoring**: Set up monitoring for email system health
4. **Backup**: Consider backup email providers for critical notifications

### Performance

- **Async Operations**: All email operations are asynchronous
- **Batch Processing**: Reminders are processed in batches
- **Memory Management**: Logs and schedules are automatically cleaned up
- **Error Recovery**: System continues operating even if email service fails

### Security

- **Credential Management**: SMTP credentials should be securely stored
- **Rate Limiting**: Consider implementing rate limiting for email sends
- **Validation**: All email addresses are validated before sending
- **Content Sanitization**: Email content is properly escaped

## Maintenance

### Regular Maintenance

The system includes automatic maintenance features:

```typescript
// Perform maintenance (clear old logs, update schedules, etc.)
const maintenanceResult = this.emailManagement.performMaintenance();
```

### Monitoring Checklist

Regular checks to perform:

1. **System Health**: Check health status regularly
2. **Error Rates**: Monitor error rates and investigate spikes
3. **Delivery Rates**: Ensure emails are being delivered successfully
4. **Configuration**: Verify configuration is correct
5. **Disk Space**: Monitor log storage usage

## Troubleshooting

### Common Issues

1. **Emails Not Sending**
   - Check SMTP configuration
   - Verify network connectivity
   - Check email service logs

2. **Reminders Not Working**
   - Verify reminder service is running
   - Check reminder configuration
   - Review reminder schedules

3. **Configuration Issues**
   - Use `getConfigStatus()` to validate configuration
   - Check environment variables
   - Verify feature flags

### Debug Information

Get debug information:

```typescript
// System status
const status = this.emailManagement.getSystemStatus();

// Recent logs
const logs = this.emailManagement.getLogs({ level: 'ERROR', count: 20 });

// Configuration status
const config = this.emailConfigService.getConfigStatus();
```

## API Reference

### EmailService Methods

- `sendShiftSignupConfirmation(shift, signup)`: Promise\<EmailResult\>
- `sendShiftCreationNotification(shift)`: Promise\<EmailResult\>
- `sendShiftSignupAdminNotification(shift, signup)`: Promise\<EmailResult\>
- `sendShiftReminder(shift, signup)`: Promise\<EmailResult\>
- `generateReminderSchedules(shifts)`: ReminderSchedule[]

### EmailConfigService Methods

- `getConfig()`: EmailConfiguration
- `updateConfig(updates)`: void
- `getConfigStatus()`: { isValid: boolean; errors: string[] }
- `isFeatureEnabled(feature)`: boolean

### EmailLoggerService Methods

- `info/warn/error/debug(component, message, data?)`: void
- `logEmailSent(type, recipient, messageId?)`: void
- `logEmailFailed(type, recipient, error)`: void
- `getMetrics()`: EmailMetrics
- `getHealthStatus()`: HealthStatus

### ReminderService Methods

- `start()`: void
- `stop()`: void
- `addReminderForSignup(shiftId, email, name, shiftStartTime)`: void
- `removeRemindersForShift(shiftId)`: void
- `removeRemindersForSignup(shiftId, email)`: void
- `getStatistics()`: ReminderStatistics

### EmailManagementService Methods

- `initialize()`: Promise\<void\>
- `shutdown()`: void
- `getSystemStatus()`: SystemStatus
- `testEmailSystem(testEmail?)`: Promise\<TestResult\>
- `performMaintenance()`: MaintenanceResult

## File Structure

```
src/app/pages/calendar/services/
├── email.service.ts                    # Core email sending
├── email-config.service.ts             # Configuration management
├── email-logger.service.ts             # Logging and monitoring
├── reminder.service.ts                 # Reminder scheduling
├── email-management.service.ts         # Central management
├── volunteer-shift.service.ts          # Updated with email integration
└── README-EMAIL-SYSTEM.md             # This documentation
```

This email system provides a robust, maintainable, and scalable solution for volunteer shift notifications while following Angular best practices and maintaining clean separation of concerns.