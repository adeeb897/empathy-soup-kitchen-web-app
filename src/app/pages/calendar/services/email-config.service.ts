import { Injectable } from '@angular/core';

export interface EmailConfiguration {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  sender: {
    name: string;
    email: string;
    adminEmail: string;
  };
  endpoints: {
    sendEmail: string;
  };
  features: {
    enableNotifications: boolean;
    enableReminders: boolean;
    enableAdminNotifications: boolean;
  };
  reminders: {
    hoursBeforeShift: number;
    checkIntervalMinutes: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EmailConfigService {
  private config: EmailConfiguration;

  constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Get the current email configuration
   */
  getConfig(): EmailConfiguration {
    return { ...this.config };
  }

  /**
   * Update email configuration
   */
  updateConfig(updates: Partial<EmailConfiguration>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * Get SMTP configuration
   */
  getSmtpConfig() {
    return { ...this.config.smtp };
  }

  /**
   * Get sender configuration
   */
  getSenderConfig() {
    return { ...this.config.sender };
  }

  /**
   * Get API endpoints
   */
  getEndpoints() {
    return { ...this.config.endpoints };
  }

  /**
   * Get feature flags
   */
  getFeatures() {
    return { ...this.config.features };
  }

  /**
   * Get reminder configuration
   */
  getReminderConfig() {
    return { ...this.config.reminders };
  }

  /**
   * Check if a specific feature is enabled
   */
  isFeatureEnabled(feature: keyof EmailConfiguration['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Load configuration from environment variables or defaults
   */
  private loadConfiguration(): EmailConfiguration {
    return {
      smtp: {
        host: this.getEnvVar('EMAIL_SMTP_HOST', 'localhost'),
        port: parseInt(this.getEnvVar('EMAIL_SMTP_PORT', '587')),
        secure: this.getEnvVar('EMAIL_SMTP_SECURE', 'false') === 'true',
        username: this.getEnvVar('EMAIL_SMTP_USERNAME', ''),
        password: this.getEnvVar('EMAIL_SMTP_PASSWORD', '')
      },
      sender: {
        name: this.getEnvVar('EMAIL_SENDER_NAME', 'Empathy Soup Kitchen'),
        email: this.getEnvVar('EMAIL_SENDER_EMAIL', 'noreply@empathysoupkitchen.org'),
        adminEmail: this.getEnvVar('EMAIL_ADMIN_EMAIL', 'admin@empathysoupkitchen.org')
      },
      endpoints: {
        sendEmail: this.getEnvVar('EMAIL_API_ENDPOINT', '/api/email/send')
      },
      features: {
        enableNotifications: this.getEnvVar('EMAIL_ENABLE_NOTIFICATIONS', 'true') === 'true',
        enableReminders: this.getEnvVar('EMAIL_ENABLE_REMINDERS', 'true') === 'true',
        enableAdminNotifications: this.getEnvVar('EMAIL_ENABLE_ADMIN_NOTIFICATIONS', 'true') === 'true'
      },
      reminders: {
        hoursBeforeShift: parseInt(this.getEnvVar('EMAIL_REMINDER_HOURS_BEFORE', '24')),
        checkIntervalMinutes: parseInt(this.getEnvVar('EMAIL_REMINDER_CHECK_INTERVAL', '60'))
      }
    };
  }

  /**
   * Get environment variable with fallback
   */
  private getEnvVar(key: string, defaultValue: string): string {
    // In Angular, environment variables are typically handled through environment files
    // This is a simple implementation that can be enhanced based on your deployment strategy
    
    if (typeof window !== 'undefined') {
      // Client-side: Check if there's a global config object
      const globalConfig = (window as any).EMAIL_CONFIG;
      if (globalConfig && globalConfig[key]) {
        return globalConfig[key];
      }
    }

    // Check localStorage for development/testing
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`EMAIL_${key}`);
      if (stored) {
        return stored;
      }
    }

    return defaultValue;
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(target: EmailConfiguration, source: Partial<EmailConfiguration>): EmailConfiguration {
    const result: EmailConfiguration = JSON.parse(JSON.stringify(target));

    Object.keys(source).forEach(key => {
      const sourceValue = (source as any)[key];
      const targetValue = (result as any)[key];

      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        (result as any)[key] = { ...targetValue, ...sourceValue };
      } else {
        (result as any)[key] = sourceValue;
      }
    });

    return result;
  }

  /**
   * Validate configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate SMTP configuration
    if (!this.config.smtp.host) {
      errors.push('SMTP host is required');
    }

    if (this.config.smtp.port <= 0 || this.config.smtp.port > 65535) {
      errors.push('SMTP port must be between 1 and 65535');
    }

    // Validate sender configuration
    if (!this.config.sender.name) {
      errors.push('Sender name is required');
    }

    if (!this.config.sender.email || !this.isValidEmail(this.config.sender.email)) {
      errors.push('Valid sender email is required');
    }

    if (!this.config.sender.adminEmail || !this.isValidEmail(this.config.sender.adminEmail)) {
      errors.push('Valid admin email is required');
    }

    // Validate endpoints
    if (!this.config.endpoints.sendEmail) {
      errors.push('Send email endpoint is required');
    }

    // Validate reminder configuration
    if (this.config.reminders.hoursBeforeShift < 1 || this.config.reminders.hoursBeforeShift > 168) {
      errors.push('Reminder hours before shift must be between 1 and 168 (1 week)');
    }

    if (this.config.reminders.checkIntervalMinutes < 5) {
      errors.push('Reminder check interval must be at least 5 minutes');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus() {
    const validation = this.validateConfig();
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      hasSmtpCredentials: !!(this.config.smtp.username && this.config.smtp.password),
      featuresEnabled: {
        notifications: this.config.features.enableNotifications,
        reminders: this.config.features.enableReminders,
        adminNotifications: this.config.features.enableAdminNotifications
      },
      config: {
        smtp: {
          host: this.config.smtp.host,
          port: this.config.smtp.port,
          secure: this.config.smtp.secure,
          hasCredentials: !!(this.config.smtp.username && this.config.smtp.password)
        },
        sender: this.config.sender,
        endpoints: this.config.endpoints,
        reminders: this.config.reminders
      }
    };
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Set configuration for development/testing
   */
  setDevelopmentConfig(config: Partial<EmailConfiguration>): void {
    if (typeof localStorage !== 'undefined') {
      Object.entries(config).forEach(([section, sectionConfig]) => {
        if (typeof sectionConfig === 'object') {
          Object.entries(sectionConfig).forEach(([key, value]) => {
            localStorage.setItem(`EMAIL_${section.toUpperCase()}_${key.toUpperCase()}`, String(value));
          });
        }
      });
    }
    
    this.config = this.loadConfiguration();
  }

  /**
   * Clear development configuration
   */
  clearDevelopmentConfig(): void {
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('EMAIL_'));
      keys.forEach(key => localStorage.removeItem(key));
    }
    
    this.config = this.loadConfiguration();
  }
}