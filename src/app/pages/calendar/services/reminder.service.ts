import { Injectable } from '@angular/core';
import { VolunteerShiftService } from './volunteer-shift.service';
import { EmailService, ReminderSchedule } from './email.service';
import { EmailConfigService } from './email-config.service';

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
    private volunteerShiftService: VolunteerShiftService,
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
   * Start the reminder service
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Reminder service is already running');
      return;
    }

    console.log('Starting reminder service...');
    this.isRunning = true;
    
    // Initial schedule generation
    this.generateReminderSchedules();
    
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
      return;
    }

    console.log('Stopping reminder service...');
    this.isRunning = false;
    
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('Reminder service stopped.');
  }

  /**
   * Update reminder configuration
   */
  updateConfig(config: Partial<ReminderConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('Reminder configuration updated:', this.config);
    
    // Regenerate schedules if running
    if (this.isRunning) {
      this.generateReminderSchedules();
    }
  }

  /**
   * Get current reminder configuration
   */
  getConfig(): ReminderConfig {
    return { ...this.config };
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
   * Add a single reminder schedule (used when new signups are created)
   */
  addReminderForSignup(shiftId: number, email: string, name: string, shiftStartTime: Date): void {
    if (!this.config.enabled) {
      return;
    }

    const reminderDate = new Date(shiftStartTime.getTime() - (this.config.hoursBeforeShift * 60 * 60 * 1000));
    
    // Only schedule if reminder is in the future
    if (reminderDate > new Date()) {
      const newReminder: ReminderSchedule = {
        shiftId,
        email,
        name,
        shiftDate: new Date(shiftStartTime),
        reminderDate,
        sent: false
      };

      // Check if this reminder already exists
      const exists = this.reminderSchedules.some(
        r => r.shiftId === shiftId && r.email === email && !r.sent
      );

      if (!exists) {
        this.reminderSchedules.push(newReminder);
        console.log(`Added reminder for ${name} (${email}) for shift ${shiftId}`);
      }
    }
  }

  /**
   * Remove reminders for a specific shift (used when shifts are deleted)
   */
  removeRemindersForShift(shiftId: number): void {
    const originalLength = this.reminderSchedules.length;
    this.reminderSchedules = this.reminderSchedules.filter(
      schedule => schedule.shiftId !== shiftId
    );
    
    const removedCount = originalLength - this.reminderSchedules.length;
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} reminders for shift ${shiftId}`);
    }
  }

  /**
   * Remove reminders for a specific signup (used when signups are cancelled)
   */
  removeRemindersForSignup(shiftId: number, email: string): void {
    const originalLength = this.reminderSchedules.length;
    this.reminderSchedules = this.reminderSchedules.filter(
      schedule => !(schedule.shiftId === shiftId && schedule.email === email)
    );
    
    const removedCount = originalLength - this.reminderSchedules.length;
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} reminders for ${email} on shift ${shiftId}`);
    }
  }

  /**
   * Generate reminder schedules from all current shifts and signups
   */
  private async generateReminderSchedules(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      console.log('Generating reminder schedules...');
      const shifts = await this.volunteerShiftService.getShiftsWithSignups();
      
      // Clear existing unsent reminders
      this.reminderSchedules = this.reminderSchedules.filter(schedule => schedule.sent);
      
      // Generate new schedules using the email service
      const newSchedules = this.emailService.generateReminderSchedules(shifts);
      
      // Add new schedules
      this.reminderSchedules.push(...newSchedules);
      
      // Remove duplicates (shouldn't happen, but safety first)
      this.reminderSchedules = this.removeDuplicateSchedules(this.reminderSchedules);
      
      console.log(`Generated ${newSchedules.length} reminder schedules. Total pending: ${this.getPendingReminders().length}`);
    } catch (error) {
      console.error('Failed to generate reminder schedules:', error);
    }
  }

  /**
   * Process and send due reminders
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
        return;
      }

      console.log(`Processing ${dueReminders.length} due reminders...`);

      for (const reminder of dueReminders) {
        try {
          // Get the current shift data
          const shift = await this.volunteerShiftService.getShiftById(reminder.shiftId);
          
          if (!shift) {
            console.warn(`Shift ${reminder.shiftId} not found, marking reminder as sent`);
            reminder.sent = true;
            continue;
          }

          // Create a mock signup object for the reminder
          const signup = {
            SignUpID: 0, // Not used in reminder emails
            ShiftID: reminder.shiftId,
            Name: reminder.name,
            Email: reminder.email,
            PhoneNumber: '', // Not used in reminder emails
            NumPeople: 1 // Default value
          };

          // Send the reminder email
          const result = await this.emailService.sendShiftReminder(shift, signup);
          
          if (result.success) {
            reminder.sent = true;
            console.log(`Successfully sent reminder to ${reminder.email} for shift ${reminder.shiftId}`);
          } else {
            console.error(`Failed to send reminder to ${reminder.email}:`, result.error);
          }
        } catch (error) {
          console.error(`Error processing reminder for ${reminder.email}:`, error);
        }
      }

      const successCount = dueReminders.filter(r => r.sent).length;
      console.log(`Successfully sent ${successCount} of ${dueReminders.length} reminder emails`);

      // Clean up old sent reminders (older than 7 days)
      this.cleanupOldReminders();
    } catch (error) {
      console.error('Error processing reminders:', error);
    }
  }

  /**
   * Remove duplicate reminder schedules
   */
  private removeDuplicateSchedules(schedules: ReminderSchedule[]): ReminderSchedule[] {
    const unique: ReminderSchedule[] = [];
    const seen = new Set<string>();

    for (const schedule of schedules) {
      const key = `${schedule.shiftId}-${schedule.email}-${schedule.reminderDate.getTime()}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(schedule);
      }
    }

    return unique;
  }

  /**
   * Clean up old sent reminders to prevent memory leaks
   */
  private cleanupOldReminders(): void {
    const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const originalLength = this.reminderSchedules.length;
    
    this.reminderSchedules = this.reminderSchedules.filter(
      schedule => !schedule.sent || schedule.reminderDate > sevenDaysAgo
    );

    const removedCount = originalLength - this.reminderSchedules.length;
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} old reminder schedules`);
    }
  }

  /**
   * Get statistics about reminders
   */
  getStatistics() {
    const pending = this.getPendingReminders();
    const sent = this.reminderSchedules.filter(r => r.sent);
    const upcoming24h = pending.filter(
      r => r.reminderDate <= new Date(Date.now() + (24 * 60 * 60 * 1000))
    );

    return {
      totalSchedules: this.reminderSchedules.length,
      pending: pending.length,
      sent: sent.length,
      upcomingIn24h: upcoming24h.length,
      isRunning: this.isRunning,
      config: this.config
    };
  }
}