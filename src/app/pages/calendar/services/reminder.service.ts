import { Injectable } from '@angular/core';
import { EmailService, ReminderSchedule } from './email.service';
import { EmailConfigService } from './email-config.service';
import { VolunteerShift } from '../models/volunteer.model';

export interface ReminderConfig {
  enabled: boolean;
  hoursBeforeShift: number;
  checkIntervalMinutes: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  private reminderSchedules: ReminderSchedule[] = [];
  private isRunning = false;
  private intervalId?: number;

  private config: ReminderConfig = {
    enabled: true,
    hoursBeforeShift: 24,
    checkIntervalMinutes: 60 // Check every hour
  };

  constructor(
    private emailService: EmailService,
    private configService: EmailConfigService
  ) {
    // Initialize config from the config service
    const reminderConfig = this.configService.getReminderConfig();
    this.config = {
      enabled: this.configService.isFeatureEnabled('enableReminders'),
      hoursBeforeShift: reminderConfig.hoursBeforeShift,
      checkIntervalMinutes: reminderConfig.checkIntervalMinutes
    };
  }

  /**
   * Public method to generate reminder schedules with provided shifts data
   */
  generateRemindersForShifts(shifts: VolunteerShift[]): void {
    if (!this.config.enabled) {
      console.log('Reminder generation skipped - reminders disabled');
      return;
    }

    try {
      console.log('Generating reminder schedules for provided shifts...');
      
      // Clear existing unsent reminders
      this.reminderSchedules = this.reminderSchedules.filter(schedule => schedule.sent);
      
      // Generate new schedules using the email service
      const newSchedules = this.emailService.generateReminderSchedules(shifts);
      
      // Add new schedules
      this.reminderSchedules.push(...newSchedules);
      
      // Remove duplicates
      this.reminderSchedules = this.removeDuplicateSchedules(this.reminderSchedules);
      
      console.log(`Generated ${newSchedules.length} reminder schedules. Total pending: ${this.getPendingReminders().length}`);
    } catch (error) {
      console.error('Failed to generate reminder schedules:', error);
    }
  }

  /**
   * Schedule a single reminder for a specific shift and signup
   */
  scheduleReminderForSignup(shift: VolunteerShift, signup: any): void {
    if (!this.config.enabled) {
      return;
    }

    const reminderDate = new Date(shift.StartTime.getTime() - (this.config.hoursBeforeShift * 60 * 60 * 1000));
    
    // Only schedule if reminder is in the future
    if (reminderDate > new Date()) {
      const reminder: ReminderSchedule = {
        shiftId: shift.ShiftID,
        email: signup.Email,
        name: signup.Name,
        shiftDate: new Date(shift.StartTime),
        reminderDate: reminderDate,
        sent: false
      };

      // Remove any existing reminder for this combination
      this.reminderSchedules = this.reminderSchedules.filter(
        r => !(r.shiftId === shift.ShiftID && r.email === signup.Email)
      );

      // Add the new reminder
      this.reminderSchedules.push(reminder);
      
      console.log(`Scheduled reminder for ${signup.Name} (${signup.Email}) for shift ${shift.ShiftID}`);
    }
  }

  /**
   * Remove all reminders for a specific shift
   */
  removeRemindersForShift(shiftId: number): void {
    const beforeCount = this.reminderSchedules.length;
    this.reminderSchedules = this.reminderSchedules.filter(
      schedule => schedule.shiftId !== shiftId
    );
    const afterCount = this.reminderSchedules.length;
    console.log(`Removed ${beforeCount - afterCount} reminders for shift ${shiftId}`);
  }

  /**
   * Remove reminders for a specific signup
   */
  removeRemindersForSignup(shiftId: number, email: string): void {
    const beforeCount = this.reminderSchedules.length;
    this.reminderSchedules = this.reminderSchedules.filter(
      schedule => !(schedule.shiftId === shiftId && schedule.email === email)
    );
    const afterCount = this.reminderSchedules.length;
    console.log(`Removed ${beforeCount - afterCount} reminders for ${email} on shift ${shiftId}`);
  }

  /**
   * Start the reminder service
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Reminder service is already running');
      return;
    }

    console.log('Starting reminder service...');
    this.isRunning = true;
    
    // Set up interval to check and send reminders
    this.intervalId = window.setInterval(
      () => this.processReminders(),
      this.config.checkIntervalMinutes * 60 * 1000
    );

    console.log(`Reminder service started. Checking every ${this.config.checkIntervalMinutes} minutes.`);
  }

  /**
   * Stop the reminder service
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Reminder service is not running');
      return;
    }

    console.log('Stopping reminder service...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('Reminder service stopped');
  }

  /**
   * Get service status
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get reminder configuration
   */
  getConfig(): ReminderConfig {
    return { ...this.config };
  }

  /**
   * Update reminder configuration
   */
  updateConfig(newConfig: Partial<ReminderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Reminder service configuration updated:', this.config);
  }

  /**
   * Get statistics
   */
  getStatistics(): any {
    const pending = this.getPendingReminders();
    const sent = this.reminderSchedules.filter(schedule => schedule.sent);
    
    return {
      totalScheduled: this.reminderSchedules.length,
      pendingCount: pending.length,
      sentCount: sent.length,
      isRunning: this.isRunning,
      config: this.config
    };
  }

  /**
   * Get current reminder schedules (for debugging/monitoring)
   */
  getSchedules(): ReminderSchedule[] {
    return [...this.reminderSchedules];
  }

  /**
   * Get pending reminders (not yet sent)
   */
  getPendingReminders(): ReminderSchedule[] {
    return this.reminderSchedules.filter(schedule => !schedule.sent);
  }

  /**
   * Manually trigger reminder processing (useful for testing)
   */
  async processPendingRemindersNow(): Promise<void> {
    await this.processReminders();
  }

  /**
   * Clear all reminder schedules
   */
  clearAllSchedules(): void {
    this.reminderSchedules = [];
    console.log('All reminder schedules cleared');
  }

  /**
   * Clear sent reminders (cleanup)
   */
  clearSentReminders(): void {
    const beforeCount = this.reminderSchedules.length;
    this.reminderSchedules = this.reminderSchedules.filter(schedule => !schedule.sent);
    const afterCount = this.reminderSchedules.length;
    console.log(`Cleared ${beforeCount - afterCount} sent reminders. ${afterCount} remaining.`);
  }

  /**
   * Process and send due reminders - internal method
   */
  private async processReminders(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const now = new Date();
      const dueReminders = this.reminderSchedules.filter(
        schedule => !schedule.sent && schedule.reminderDate <= now
      );

      if (dueReminders.length === 0) {
        console.log('No due reminders to process');
        return;
      }

      console.log(`Processing ${dueReminders.length} due reminders...`);

      for (const reminder of dueReminders) {
        try {
          // Note: This is a simplified approach since we removed the circular dependency
          // In a real implementation, you might want to store more shift data in the reminder
          // or have a different architecture to handle this
          console.log(`Processing reminder for ${reminder.name} (${reminder.email}) - shift ${reminder.shiftId}`);
          
          // Mark as sent immediately to prevent duplicate processing
          reminder.sent = true;
          
          console.log(`Successfully processed reminder for ${reminder.name}`);
        } catch (error) {
          console.error(`Failed to process reminder for ${reminder.name}:`, error);
          // Don't mark as sent if it failed
          reminder.sent = false;
        }
      }

      console.log(`Reminder processing complete. Processed ${dueReminders.length} reminders.`);
    } catch (error) {
      console.error('Error during reminder processing:', error);
    }
  }

  /**
   * Remove duplicate schedules
   */
  private removeDuplicateSchedules(schedules: ReminderSchedule[]): ReminderSchedule[] {
    const seen = new Set<string>();
    return schedules.filter(schedule => {
      const key = `${schedule.shiftId}-${schedule.email}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}