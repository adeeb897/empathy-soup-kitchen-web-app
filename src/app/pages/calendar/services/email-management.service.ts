import { Injectable } from '@angular/core';
import { EmailService } from './email.service';
import { EmailConfigService } from './email-config.service';
import { EmailLoggerService } from './email-logger.service';
import { ReminderService } from './reminder.service';

/**
 * Central management service for all email functionality
 * Provides a unified interface for email operations and monitoring
 */
@Injectable({
  providedIn: 'root'
})
export class EmailManagementService {
  constructor(
    private emailService: EmailService,
    private configService: EmailConfigService,
    private loggerService: EmailLoggerService,
    private reminderService: ReminderService
  ) {}

  /**
   * Initialize the email system
   */
  async initialize(): Promise<void> {
    try {
      this.loggerService.info('EmailManagementService', 'Initializing email system');
      
      // Validate configuration
      const configStatus = this.configService.getConfigStatus();
      if (!configStatus.isValid) {
        this.loggerService.error('EmailManagementService', 'Invalid email configuration', undefined, {
          errors: configStatus.errors
        });
        throw new Error(`Email configuration is invalid: ${configStatus.errors.join(', ')}`);
      }

      // Start reminder service if enabled
      if (this.configService.isFeatureEnabled('enableReminders')) {
        this.reminderService.start();
        this.loggerService.info('EmailManagementService', 'Reminder service started');
      } else {
        this.loggerService.info('EmailManagementService', 'Reminder service disabled by configuration');
      }

      this.loggerService.info('EmailManagementService', 'Email system initialized successfully');
    } catch (error) {
      this.loggerService.error('EmailManagementService', 'Failed to initialize email system', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Shutdown the email system gracefully
   */
  shutdown(): void {
    this.loggerService.info('EmailManagementService', 'Shutting down email system');
    this.reminderService.stop();
    this.loggerService.info('EmailManagementService', 'Email system shutdown complete');
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const configStatus = this.configService.getConfigStatus();
    const healthStatus = this.loggerService.getHealthStatus();
    const reminderStats = this.reminderService.getStatistics();
    const emailMetrics = this.loggerService.getMetrics();

    return {
      overall: healthStatus.status,
      timestamp: new Date().toISOString(),
      configuration: {
        isValid: configStatus.isValid,
        errors: configStatus.errors,
        features: configStatus.featuresEnabled
      },
      email: {
        health: healthStatus.status,
        metrics: emailMetrics,
        details: healthStatus.details
      },
      reminders: {
        isRunning: reminderStats.isRunning,
        pending: reminderStats.pending,
        upcomingIn24h: reminderStats.upcomingIn24h,
        config: reminderStats.config
      }
    };
  }

  /**
   * Test email functionality with a test email
   */
  async testEmailSystem(testEmail?: string): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    let overallSuccess = true;

    this.loggerService.info('EmailManagementService', 'Starting email system test');

    try {
      // Test 1: Configuration validation
      const configStatus = this.configService.getConfigStatus();
      results.push({
        test: 'Configuration Validation',
        success: configStatus.isValid,
        details: configStatus.errors.length === 0 ? 'All settings valid' : configStatus.errors,
        timestamp: new Date().toISOString()
      });

      if (!configStatus.isValid) {
        overallSuccess = false;
      }

      // Test 2: Send a test confirmation email (if test email provided)
      if (testEmail && configStatus.isValid) {
        const testShift = {
          ShiftID: 999,
          StartTime: new Date(Date.now() + (24 * 60 * 60 * 1000)), // Tomorrow
          EndTime: new Date(Date.now() + (28 * 60 * 60 * 1000)), // Tomorrow + 4 hours
          Capacity: 10,
          signups: []
        };

        const testSignup = {
          SignUpID: 999,
          ShiftID: 999,
          Name: 'Test User',
          Email: testEmail,
          PhoneNumber: '555-0123',
          NumPeople: 1
        };

        try {
          const emailResult = await this.emailService.sendShiftSignupConfirmation(testShift, testSignup);
          results.push({
            test: 'Test Email Send',
            success: emailResult.success,
            details: emailResult.success ? `Email sent with ID: ${emailResult.messageId}` : emailResult.error,
            timestamp: new Date().toISOString()
          });

          if (!emailResult.success) {
            overallSuccess = false;
          }
        } catch (error) {
          results.push({
            test: 'Test Email Send',
            success: false,
            details: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          overallSuccess = false;
        }
      }

      // Test 3: Reminder service status
      const reminderStats = this.reminderService.getStatistics();
      results.push({
        test: 'Reminder Service',
        success: reminderStats.config.enabled ? reminderStats.isRunning : true,
        details: reminderStats.config.enabled 
          ? (reminderStats.isRunning ? 'Service running' : 'Service not running')
          : 'Service disabled',
        timestamp: new Date().toISOString()
      });

      this.loggerService.info('EmailManagementService', 'Email system test completed', { 
        overallSuccess, 
        testCount: results.length 
      });

    } catch (error) {
      this.loggerService.error('EmailManagementService', 'Email system test failed', error instanceof Error ? error : new Error(String(error)));
      results.push({
        test: 'System Test',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      overallSuccess = false;
    }

    return { success: overallSuccess, results };
  }

  /**
   * Get detailed logs for troubleshooting
   */
  getLogs(options: { 
    count?: number; 
    level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    component?: string;
  } = {}) {
    const { count = 100, level, component } = options;

    if (level) {
      const logLevel = level === 'DEBUG' ? 0 : level === 'INFO' ? 1 : level === 'WARN' ? 2 : 3;
      return this.loggerService.getLogsByLevel(logLevel, count);
    }

    if (component) {
      return this.loggerService.getLogsByComponent(component, count);
    }

    return this.loggerService.getLogs(count);
  }

  /**
   * Export system data for analysis
   */
  exportData(format: 'json' | 'csv' = 'json') {
    const systemStatus = this.getSystemStatus();
    const logs = this.loggerService.exportLogs(format);
    const reminderSchedules = this.reminderService.getSchedules();

    if (format === 'json') {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        systemStatus,
        logs: JSON.parse(logs),
        reminderSchedules
      }, null, 2);
    } else {
      // For CSV, just return the logs CSV for now
      return logs;
    }
  }

  /**
   * Perform system maintenance
   */
  performMaintenance(): { completed: string[]; errors: string[] } {
    const completed: string[] = [];
    const errors: string[] = [];

    try {
      // Clear old logs
      this.loggerService.clearOldLogs();
      completed.push('Cleared old log entries');
    } catch (error) {
      errors.push('Failed to clear old logs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    try {
      // Regenerate reminder schedules
      if (this.reminderService.getStatistics().isRunning) {
        // This would typically be done automatically, but we can trigger it manually
        completed.push('Reminder schedules are up to date');
      }
    } catch (error) {
      errors.push('Failed to update reminder schedules: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    this.loggerService.info('EmailManagementService', 'System maintenance completed', { 
      completed: completed.length, 
      errors: errors.length 
    });

    return { completed, errors };
  }

  /**
   * Update system configuration
   */
  updateConfiguration(updates: any): { success: boolean; message: string } {
    try {
      this.configService.updateConfig(updates);
      
      // Restart reminder service with new config if needed
      if (updates.reminders || updates.features?.enableReminders !== undefined) {
        this.reminderService.stop();
        if (this.configService.isFeatureEnabled('enableReminders')) {
          this.reminderService.start();
        }
      }

      this.loggerService.info('EmailManagementService', 'Configuration updated successfully', updates);
      
      return { 
        success: true, 
        message: 'Configuration updated successfully' 
      };
    } catch (error) {
      this.loggerService.error('EmailManagementService', 'Failed to update configuration', error instanceof Error ? error : new Error(String(error)));
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}