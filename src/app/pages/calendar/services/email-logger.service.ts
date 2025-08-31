import { Injectable } from '@angular/core';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
}

export interface EmailMetrics {
  totalSent: number;
  totalFailed: number;
  confirmationEmailsSent: number;
  adminNotificationsSent: number;
  remindersSent: number;
  lastEmailSent?: Date;
  lastError?: Date;
  errors: string[];
}

@Injectable({
  providedIn: 'root'
})
export class EmailLoggerService {
  private logs: LogEntry[] = [];
  private metrics: EmailMetrics = {
    totalSent: 0,
    totalFailed: 0,
    confirmationEmailsSent: 0,
    adminNotificationsSent: 0,
    remindersSent: 0,
    errors: []
  };
  
  private readonly maxLogs = 1000; // Keep only last 1000 log entries
  private readonly maxErrors = 50; // Keep only last 50 errors in metrics
  private logLevel: LogLevel = LogLevel.INFO;

  constructor() {
    this.loadStoredMetrics();
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Log debug message
   */
  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  /**
   * Log info message
   */
  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  /**
   * Log warning message
   */
  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, component, message, data);
  }

  /**
   * Log error message
   */
  error(component: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, component, message, data, error);
    
    // Track error in metrics
    this.metrics.totalFailed++;
    this.metrics.lastError = new Date();
    this.metrics.errors.unshift(`${component}: ${message}`);
    
    // Keep only recent errors
    if (this.metrics.errors.length > this.maxErrors) {
      this.metrics.errors = this.metrics.errors.slice(0, this.maxErrors);
    }
    
    this.saveMetrics();
  }

  /**
   * Log successful email send
   */
  logEmailSent(type: 'confirmation' | 'admin_notification' | 'reminder', recipient: string, messageId?: string): void {
    this.metrics.totalSent++;
    this.metrics.lastEmailSent = new Date();
    
    switch (type) {
      case 'confirmation':
        this.metrics.confirmationEmailsSent++;
        break;
      case 'admin_notification':
        this.metrics.adminNotificationsSent++;
        break;
      case 'reminder':
        this.metrics.remindersSent++;
        break;
    }
    
    this.info('EmailService', `${type} email sent successfully`, {
      recipient,
      messageId,
      type
    });
    
    this.saveMetrics();
  }

  /**
   * Log failed email send
   */
  logEmailFailed(type: 'confirmation' | 'admin_notification' | 'reminder', recipient: string, error: string): void {
    this.error('EmailService', `Failed to send ${type} email to ${recipient}`, new Error(error), {
      recipient,
      type,
      error
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): EmailMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent logs
   */
  getLogs(count?: number): LogEntry[] {
    const logsToReturn = count ? this.logs.slice(-count) : this.logs;
    return logsToReturn.map(log => ({ ...log }));
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel, count?: number): LogEntry[] {
    const filteredLogs = this.logs.filter(log => log.level >= level);
    return count ? filteredLogs.slice(-count) : filteredLogs;
  }

  /**
   * Get logs by component
   */
  getLogsByComponent(component: string, count?: number): LogEntry[] {
    const filteredLogs = this.logs.filter(log => log.component === component);
    return count ? filteredLogs.slice(-count) : filteredLogs;
  }

  /**
   * Get error summary
   */
  getErrorSummary(): { totalErrors: number; recentErrors: string[]; lastError?: Date } {
    return {
      totalErrors: this.metrics.totalFailed,
      recentErrors: this.metrics.errors.slice(0, 10),
      lastError: this.metrics.lastError
    };
  }

  /**
   * Get system health status
   */
  getHealthStatus(): { status: 'healthy' | 'warning' | 'error'; details: any } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const recentErrors = this.logs.filter(log => 
      log.level === LogLevel.ERROR && log.timestamp > oneHourAgo
    ).length;
    
    const successRate = this.metrics.totalSent > 0 
      ? (this.metrics.totalSent / (this.metrics.totalSent + this.metrics.totalFailed)) * 100
      : 100;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (recentErrors > 10 || successRate < 80) {
      status = 'error';
    } else if (recentErrors > 5 || successRate < 95) {
      status = 'warning';
    }

    return {
      status,
      details: {
        successRate: Math.round(successRate * 100) / 100,
        recentErrors,
        totalSent: this.metrics.totalSent,
        totalFailed: this.metrics.totalFailed,
        lastEmailSent: this.metrics.lastEmailSent,
        lastError: this.metrics.lastError
      }
    };
  }

  /**
   * Clear old logs to prevent memory issues
   */
  clearOldLogs(): void {
    const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000));
    this.logs = this.logs.filter(log => log.timestamp > threeDaysAgo);
    
    this.info('EmailLoggerService', `Cleared old logs. Current log count: ${this.logs.length}`);
  }

  /**
   * Reset metrics (useful for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics = {
      totalSent: 0,
      totalFailed: 0,
      confirmationEmailsSent: 0,
      adminNotificationsSent: 0,
      remindersSent: 0,
      errors: []
    };
    
    this.saveMetrics();
    this.info('EmailLoggerService', 'Email metrics have been reset');
  }

  /**
   * Export logs for analysis
   */
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['Timestamp', 'Level', 'Component', 'Message', 'Data', 'Error'];
      const csvRows = [
        headers.join(','),
        ...this.logs.map(log => [
          log.timestamp.toISOString(),
          LogLevel[log.level],
          log.component,
          `"${log.message.replace(/"/g, '""')}"`,
          log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : '',
          log.error ? `"${log.error.message.replace(/"/g, '""')}"` : ''
        ].join(','))
      ];
      
      return csvRows.join('\n');
    } else {
      return JSON.stringify({
        exportDate: new Date().toISOString(),
        metrics: this.metrics,
        logs: this.logs
      }, null, 2);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, component: string, message: string, data?: any, error?: Error): void {
    if (level < this.logLevel) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      component,
      message,
      data,
      error
    };

    this.logs.push(logEntry);

    // Keep only recent logs to prevent memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to browser console for development
    const consoleMessage = `[${LogLevel[level]}] ${component}: ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(consoleMessage, data);
        break;
      case LogLevel.INFO:
        console.info(consoleMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, data, error);
        break;
      case LogLevel.ERROR:
        console.error(consoleMessage, data, error);
        break;
    }
  }

  /**
   * Load stored metrics from localStorage
   */
  private loadStoredMetrics(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('emailMetrics');
        if (stored) {
          const parsedMetrics = JSON.parse(stored);
          // Restore dates
          if (parsedMetrics.lastEmailSent) {
            parsedMetrics.lastEmailSent = new Date(parsedMetrics.lastEmailSent);
          }
          if (parsedMetrics.lastError) {
            parsedMetrics.lastError = new Date(parsedMetrics.lastError);
          }
          
          this.metrics = { ...this.metrics, ...parsedMetrics };
        }
      }
    } catch (error) {
      this.warn('EmailLoggerService', 'Failed to load stored metrics', error);
    }
  }

  /**
   * Save metrics to localStorage
   */
  private saveMetrics(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('emailMetrics', JSON.stringify(this.metrics));
      }
    } catch (error) {
      this.warn('EmailLoggerService', 'Failed to save metrics', error);
    }
  }
}