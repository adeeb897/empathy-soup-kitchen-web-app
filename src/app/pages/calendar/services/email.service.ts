import { Injectable } from '@angular/core';
import { VolunteerShift, SignUp } from '../models/volunteer.model';
import { EmailConfigService } from './email-config.service';
import { EmailLoggerService } from './email-logger.service';

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface EmailData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  fromName?: string;
  fromEmail?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ReminderSchedule {
  shiftId: number;
  email: string;
  name: string;
  shiftDate: Date;
  reminderDate: Date;
  sent: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  constructor(
    private configService: EmailConfigService,
    private logger: EmailLoggerService
  ) {}

  /**
   * Send a shift creation confirmation email to the user who signed up
   */
  async sendShiftSignupConfirmation(shift: VolunteerShift, signup: SignUp): Promise<EmailResult> {
    if (!this.configService.isFeatureEnabled('enableNotifications')) {
      this.logger.debug('EmailService', 'Signup confirmation skipped - notifications disabled');
      return { success: true, messageId: 'skipped-feature-disabled' };
    }

    try {
      this.logger.info('EmailService', 'Sending signup confirmation email', { shiftId: shift.ShiftID, email: signup.Email });
      
      const template = this.generateShiftSignupConfirmationTemplate(shift, signup);
      const senderConfig = this.configService.getSenderConfig();
      
      const emailData: EmailData = {
        to: signup.Email,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        fromName: senderConfig.name,
        fromEmail: senderConfig.email
      };

      const result = await this.sendEmail(emailData);
      
      if (result.success) {
        this.logger.logEmailSent('confirmation', signup.Email, result.messageId);
      } else {
        this.logger.logEmailFailed('confirmation', signup.Email, result.error || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      this.logger.error('EmailService', 'Error sending shift signup confirmation', error instanceof Error ? error : new Error(String(error)));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send a notification to admins when a new shift is created
   */
  async sendShiftCreationNotification(shift: VolunteerShift): Promise<EmailResult> {
    if (!this.configService.isFeatureEnabled('enableAdminNotifications')) {
      this.logger.debug('EmailService', 'Admin notification skipped - admin notifications disabled');
      return { success: true, messageId: 'skipped-feature-disabled' };
    }

    try {
      this.logger.info('EmailService', 'Sending shift creation notification to admin', { shiftId: shift.ShiftID });
      
      const template = this.generateShiftCreationNotificationTemplate(shift);
      const senderConfig = this.configService.getSenderConfig();
      
      const emailData: EmailData = {
        to: senderConfig.adminEmail,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        fromName: senderConfig.name,
        fromEmail: senderConfig.email
      };

      const result = await this.sendEmail(emailData);
      
      if (result.success) {
        this.logger.logEmailSent('admin_notification', senderConfig.adminEmail, result.messageId);
      } else {
        this.logger.logEmailFailed('admin_notification', senderConfig.adminEmail, result.error || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      this.logger.error('EmailService', 'Error sending shift creation notification', error instanceof Error ? error : new Error(String(error)));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send a notification to admins when someone signs up for a shift
   */
  async sendShiftSignupAdminNotification(shift: VolunteerShift, signup: SignUp): Promise<EmailResult> {
    if (!this.configService.isFeatureEnabled('enableAdminNotifications')) {
      this.logger.debug('EmailService', 'Admin signup notification skipped - admin notifications disabled');
      return { success: true, messageId: 'skipped-feature-disabled' };
    }

    try {
      this.logger.info('EmailService', 'Sending signup notification to admin', { shiftId: shift.ShiftID, volunteerEmail: signup.Email });
      
      const template = this.generateShiftSignupAdminNotificationTemplate(shift, signup);
      const senderConfig = this.configService.getSenderConfig();
      
      const emailData: EmailData = {
        to: senderConfig.adminEmail,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        fromName: senderConfig.name,
        fromEmail: senderConfig.email
      };

      const result = await this.sendEmail(emailData);
      
      if (result.success) {
        this.logger.logEmailSent('admin_notification', senderConfig.adminEmail, result.messageId);
      } else {
        this.logger.logEmailFailed('admin_notification', senderConfig.adminEmail, result.error || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      this.logger.error('EmailService', 'Error sending shift signup admin notification', error instanceof Error ? error : new Error(String(error)));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send reminder emails for upcoming shifts
   */
  async sendShiftReminder(shift: VolunteerShift, signup: SignUp): Promise<EmailResult> {
    if (!this.configService.isFeatureEnabled('enableReminders')) {
      this.logger.debug('EmailService', 'Reminder skipped - reminders disabled');
      return { success: true, messageId: 'skipped-feature-disabled' };
    }

    try {
      this.logger.info('EmailService', 'Sending shift reminder', { shiftId: shift.ShiftID, email: signup.Email });
      
      const template = this.generateShiftReminderTemplate(shift, signup);
      const senderConfig = this.configService.getSenderConfig();
      
      const emailData: EmailData = {
        to: signup.Email,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        fromName: senderConfig.name,
        fromEmail: senderConfig.email
      };

      const result = await this.sendEmail(emailData);
      
      if (result.success) {
        this.logger.logEmailSent('reminder', signup.Email, result.messageId);
      } else {
        this.logger.logEmailFailed('reminder', signup.Email, result.error || 'Unknown error');
      }
      
      return result;
    } catch (error) {
      this.logger.error('EmailService', 'Error sending shift reminder', error instanceof Error ? error : new Error(String(error)));
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate reminder schedules for all signups
   */
  generateReminderSchedules(shifts: VolunteerShift[]): ReminderSchedule[] {
    if (!this.configService.isFeatureEnabled('enableReminders')) {
      return [];
    }

    const schedules: ReminderSchedule[] = [];
    const reminderConfig = this.configService.getReminderConfig();
    
    for (const shift of shifts) {
      if (shift.signups) {
        for (const signup of shift.signups) {
          // Schedule reminder based on configuration
          const reminderDate = new Date(shift.StartTime.getTime() - (reminderConfig.hoursBeforeShift * 60 * 60 * 1000));
          
          // Only schedule if reminder is in the future
          if (reminderDate > new Date()) {
            schedules.push({
              shiftId: shift.ShiftID,
              email: signup.Email,
              name: signup.Name,
              shiftDate: new Date(shift.StartTime),
              reminderDate: reminderDate,
              sent: false
            });
          }
        }
      }
    }
    
    return schedules;
  }

  /**
   * Check for and send due reminders
   */
  async processPendingReminders(schedules: ReminderSchedule[]): Promise<void> {
    const now = new Date();
    const dueReminders = schedules.filter(schedule => 
      !schedule.sent && schedule.reminderDate <= now
    );

    for (const reminder of dueReminders) {
      try {
        // You would fetch the actual shift data here
        // For now, creating a mock shift for the reminder
        const shift: VolunteerShift = {
          ShiftID: reminder.shiftId,
          StartTime: reminder.shiftDate,
          EndTime: new Date(reminder.shiftDate.getTime() + (4 * 60 * 60 * 1000)), // 4 hours later
          Capacity: 10,
          signups: []
        };

        const signup: SignUp = {
          SignUpID: 0,
          ShiftID: reminder.shiftId,
          Name: reminder.name,
          Email: reminder.email,
          PhoneNumber: '',
          NumPeople: 1
        };

        const result = await this.sendShiftReminder(shift, signup);
        if (result.success) {
          reminder.sent = true;
        }
      } catch (error) {
        console.error(`Failed to send reminder to ${reminder.email}:`, error);
      }
    }
  }

  /**
   * Core email sending functionality
   */
  private async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      const endpoints = this.configService.getEndpoints();
      
      this.logger.debug('EmailService', 'Attempting to send email', { 
        to: emailData.to, 
        subject: emailData.subject,
        endpoint: endpoints.sendEmail
      });
      
      const response = await fetch(endpoints.sendEmail, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        const errorMessage = `Email service responded with status: ${response.status} - ${errorText}`;
        this.logger.error('EmailService', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const messageId = result.messageId || 'unknown';
      
      this.logger.debug('EmailService', 'Email sent successfully', { 
        to: emailData.to,
        messageId 
      });
      
      return { 
        success: true, 
        messageId 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('EmailService', 'Failed to send email', error instanceof Error ? error : new Error(errorMessage), {
        to: emailData.to,
        subject: emailData.subject
      });
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  /**
   * Generate shift signup confirmation email template
   */
  private generateShiftSignupConfirmationTemplate(shift: VolunteerShift, signup: SignUp): EmailTemplate {
    const senderConfig = this.configService.getSenderConfig();
    const shiftDate = shift.StartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const shiftTime = `${shift.StartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${shift.EndTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;

    const subject = `Volunteer Shift Confirmation - ${shiftDate}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Volunteer Shift Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2e7d32; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background-color: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .shift-details { background-color: #e8f5e8; padding: 20px; border-left: 4px solid #2e7d32; margin: 20px 0; }
          .shift-details h3 { margin-top: 0; color: #2e7d32; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; display: inline-block; width: 120px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2e7d32; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Thank You for Volunteering!</h1>
          </div>
          
          <div class="content">
            <div class="card">
              <h2>Hi ${signup.Name},</h2>
              <p>Thank you for signing up to volunteer with the Empathy Soup Kitchen. Your commitment to helping our community is greatly appreciated!</p>
            </div>

            <div class="shift-details">
              <h3>Your Volunteer Shift Details</h3>
              <div class="detail-row">
                <span class="detail-label">Date:</span> ${shiftDate}
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span> ${shiftTime}
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of People:</span> ${signup.NumPeople}
              </div>
            </div>

            <div class="card">
              <h3>What to Expect</h3>
              <p>Please arrive 15 minutes before your scheduled time. We'll provide you with:</p>
              <ul>
                <li>Brief orientation and safety instructions</li>
                <li>Aprons and hair coverings</li>
                <li>Clear guidance on your role during the shift</li>
              </ul>
              
              <h3>What to Bring</h3>
              <ul>
                <li>Comfortable, closed-toe shoes</li>
                <li>Hair tie if you have long hair</li>
                <li>Positive attitude and willingness to help</li>
              </ul>

              <h3>Location</h3>
              <p>
                Empathy Soup Kitchen<br>
                [Address will be provided separately]
              </p>
            </div>

            <div class="card">
              <h3>Need to Make Changes?</h3>
              <p>If you need to cancel or modify your volunteer slot, please contact us as soon as possible at <strong>${senderConfig.adminEmail}</strong> or call us at [Phone Number].</p>
              
              <p>We understand that things come up, but advance notice helps us ensure we have adequate coverage for our guests.</p>
            </div>

            <div class="card">
              <p><strong>We'll send you a reminder email 24 hours before your shift.</strong></p>
              <p>If you have any questions or concerns, please don't hesitate to reach out to us.</p>
              <p>Thank you again for your service to the community!</p>
              <p>Warm regards,<br>The Empathy Soup Kitchen Team</p>
            </div>
          </div>

          <div class="footer">
            <p>This email was sent to ${signup.Email}</p>
            <p>Empathy Soup Kitchen | Making a difference, one meal at a time</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Thank You for Volunteering!

Hi ${signup.Name},

Thank you for signing up to volunteer with the Empathy Soup Kitchen. Your commitment to helping our community is greatly appreciated!

Your Volunteer Shift Details:
- Date: ${shiftDate}
- Time: ${shiftTime}
- Number of People: ${signup.NumPeople}

What to Expect:
Please arrive 15 minutes before your scheduled time. We'll provide you with:
- Brief orientation and safety instructions
- Aprons and hair coverings
- Clear guidance on your role during the shift

What to Bring:
- Comfortable, closed-toe shoes
- Hair tie if you have long hair
- Positive attitude and willingness to help

Location:
Empathy Soup Kitchen
[Address will be provided separately]

Need to Make Changes?
If you need to cancel or modify your volunteer slot, please contact us as soon as possible at ${senderConfig.adminEmail} or call us at [Phone Number].

We understand that things come up, but advance notice helps us ensure we have adequate coverage for our guests.

We'll send you a reminder email 24 hours before your shift.

If you have any questions or concerns, please don't hesitate to reach out to us.

Thank you again for your service to the community!

Warm regards,
The Empathy Soup Kitchen Team

This email was sent to ${signup.Email}
Empathy Soup Kitchen | Making a difference, one meal at a time
    `.trim();

    return { subject, htmlContent, textContent };
  }

  /**
   * Generate shift creation notification email template for admins
   */
  private generateShiftCreationNotificationTemplate(shift: VolunteerShift): EmailTemplate {
    const shiftDate = shift.StartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const shiftTime = `${shift.StartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${shift.EndTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;

    const subject = `New Volunteer Shift Created - ${shiftDate}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Volunteer Shift Created</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1565c0; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background-color: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .shift-details { background-color: #e3f2fd; padding: 20px; border-left: 4px solid #1565c0; margin: 20px 0; }
          .shift-details h3 { margin-top: 0; color: #1565c0; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; display: inline-block; width: 120px; }
          .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Volunteer Shift Created</h1>
          </div>
          
          <div class="content">
            <div class="card">
              <h2>Admin Notification</h2>
              <p>A new volunteer shift has been created in the system and is now available for volunteer signups.</p>
            </div>

            <div class="shift-details">
              <h3>Shift Details</h3>
              <div class="detail-row">
                <span class="detail-label">Shift ID:</span> #${shift.ShiftID}
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span> ${shiftDate}
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span> ${shiftTime}
              </div>
              <div class="detail-row">
                <span class="detail-label">Capacity:</span> ${shift.Capacity} volunteers
              </div>
              <div class="detail-row">
                <span class="detail-label">Current Signups:</span> ${shift.signups?.length || 0}
              </div>
            </div>

            <div class="alert">
              <strong>Action Required:</strong> Please ensure all necessary preparations are made for this volunteer shift, including staff scheduling and material preparation.
            </div>

            <div class="card">
              <h3>Next Steps</h3>
              <ul>
                <li>Review shift details and confirm all information is correct</li>
                <li>Ensure adequate staff supervision is scheduled</li>
                <li>Prepare necessary materials and equipment</li>
                <li>Monitor volunteer signups as the date approaches</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Empathy Soup Kitchen Admin System</p>
            <p>This is an automated notification</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
New Volunteer Shift Created

Admin Notification:
A new volunteer shift has been created in the system and is now available for volunteer signups.

Shift Details:
- Shift ID: #${shift.ShiftID}
- Date: ${shiftDate}
- Time: ${shiftTime}
- Capacity: ${shift.Capacity} volunteers
- Current Signups: ${shift.signups?.length || 0}

Action Required:
Please ensure all necessary preparations are made for this volunteer shift, including staff scheduling and material preparation.

Next Steps:
- Review shift details and confirm all information is correct
- Ensure adequate staff supervision is scheduled
- Prepare necessary materials and equipment
- Monitor volunteer signups as the date approaches

Empathy Soup Kitchen Admin System
This is an automated notification
    `.trim();

    return { subject, htmlContent, textContent };
  }

  /**
   * Generate admin notification when someone signs up for a shift
   */
  private generateShiftSignupAdminNotificationTemplate(shift: VolunteerShift, signup: SignUp): EmailTemplate {
    const shiftDate = shift.StartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const shiftTime = `${shift.StartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${shift.EndTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;

    const currentSignups = shift.signups?.reduce((total, s) => total + (s.NumPeople || 1), 0) || 0;
    const remainingCapacity = shift.Capacity - currentSignups;

    const subject = `New Volunteer Signup - ${signup.Name} (${shiftDate})`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Volunteer Signup</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1565c0; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background-color: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .volunteer-details { background-color: #e8f5e8; padding: 20px; border-left: 4px solid #2e7d32; margin: 20px 0; }
          .volunteer-details h3 { margin-top: 0; color: #2e7d32; }
          .shift-details { background-color: #e3f2fd; padding: 20px; border-left: 4px solid #1565c0; margin: 20px 0; }
          .shift-details h3 { margin-top: 0; color: #1565c0; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; display: inline-block; width: 120px; }
          .capacity-info { background-color: ${remainingCapacity <= 3 ? '#fff3cd' : '#d4edda'}; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Volunteer Signup</h1>
          </div>
          
          <div class="content">
            <div class="card">
              <h2>Volunteer Registration Alert</h2>
              <p>A new volunteer has signed up for an upcoming shift. Please review the details below.</p>
            </div>

            <div class="volunteer-details">
              <h3>Volunteer Information</h3>
              <div class="detail-row">
                <span class="detail-label">Name:</span> ${signup.Name}
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span> ${signup.Email}
              </div>
              <div class="detail-row">
                <span class="detail-label">Phone:</span> ${signup.PhoneNumber}
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of People:</span> ${signup.NumPeople}
              </div>
            </div>

            <div class="shift-details">
              <h3>Shift Details</h3>
              <div class="detail-row">
                <span class="detail-label">Shift ID:</span> #${shift.ShiftID}
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span> ${shiftDate}
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span> ${shiftTime}
              </div>
            </div>

            <div class="capacity-info">
              <h3>Current Capacity Status</h3>
              <div class="detail-row">
                <span class="detail-label">Total Capacity:</span> ${shift.Capacity}
              </div>
              <div class="detail-row">
                <span class="detail-label">Filled Spots:</span> ${currentSignups}
              </div>
              <div class="detail-row">
                <span class="detail-label">Remaining:</span> ${remainingCapacity}
              </div>
              ${remainingCapacity <= 3 ? '<p><strong>Note:</strong> This shift is nearly full!</p>' : ''}
            </div>

            <div class="card">
              <h3>Action Items</h3>
              <ul>
                <li>Confirm volunteer has received their confirmation email</li>
                <li>Add volunteer information to your records</li>
                ${remainingCapacity <= 3 ? '<li>Consider preparing for capacity management</li>' : ''}
                <li>Schedule reminder communications if needed</li>
              </ul>
            </div>
          </div>

          <div class="footer">
            <p>Empathy Soup Kitchen Admin System</p>
            <p>This is an automated notification</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
New Volunteer Signup

Volunteer Registration Alert:
A new volunteer has signed up for an upcoming shift. Please review the details below.

Volunteer Information:
- Name: ${signup.Name}
- Email: ${signup.Email}
- Phone: ${signup.PhoneNumber}
- Number of People: ${signup.NumPeople}

Shift Details:
- Shift ID: #${shift.ShiftID}
- Date: ${shiftDate}
- Time: ${shiftTime}

Current Capacity Status:
- Total Capacity: ${shift.Capacity}
- Filled Spots: ${currentSignups}
- Remaining: ${remainingCapacity}
${remainingCapacity <= 3 ? '\nNote: This shift is nearly full!' : ''}

Action Items:
- Confirm volunteer has received their confirmation email
- Add volunteer information to your records
${remainingCapacity <= 3 ? '- Consider preparing for capacity management\n' : ''}- Schedule reminder communications if needed

Empathy Soup Kitchen Admin System
This is an automated notification
    `.trim();

    return { subject, htmlContent, textContent };
  }

  /**
   * Generate shift reminder email template
   */
  private generateShiftReminderTemplate(shift: VolunteerShift, signup: SignUp): EmailTemplate {
    const senderConfig = this.configService.getSenderConfig();
    const shiftDate = shift.StartTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const shiftTime = `${shift.StartTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${shift.EndTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;

    const hoursUntilShift = Math.round((shift.StartTime.getTime() - new Date().getTime()) / (1000 * 60 * 60));

    const subject = `Reminder: Your volunteer shift is tomorrow - ${shiftDate}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Volunteer Shift Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff9800; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background-color: #f9f9f9; padding: 30px 20px; border-radius: 0 0 8px 8px; }
          .card { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .shift-details { background-color: #fff3e0; padding: 20px; border-left: 4px solid #ff9800; margin: 20px 0; }
          .shift-details h3 { margin-top: 0; color: #e65100; }
          .detail-row { margin: 10px 0; }
          .detail-label { font-weight: bold; display: inline-block; width: 120px; }
          .reminder-box { background-color: #ffecb3; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .reminder-box h2 { margin-top: 0; color: #e65100; font-size: 24px; }
          .checklist { background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .checklist h3 { margin-top: 0; color: #2e7d32; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Volunteer Shift Reminder</h1>
          </div>
          
          <div class="content">
            <div class="reminder-box">
              <h2>Your shift is in ${hoursUntilShift} hours!</h2>
              <p style="font-size: 18px; margin: 0;">Don't forget about your volunteer commitment tomorrow.</p>
            </div>

            <div class="card">
              <h2>Hi ${signup.Name},</h2>
              <p>This is a friendly reminder about your upcoming volunteer shift with the Empathy Soup Kitchen. We're looking forward to having you join our team!</p>
            </div>

            <div class="shift-details">
              <h3>Your Shift Details</h3>
              <div class="detail-row">
                <span class="detail-label">Date:</span> ${shiftDate}
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span> ${shiftTime}
              </div>
              <div class="detail-row">
                <span class="detail-label">Number of People:</span> ${signup.NumPeople}
              </div>
            </div>

            <div class="checklist">
              <h3>Pre-Shift Checklist</h3>
              <p>Please make sure you have:</p>
              <ul style="list-style-type: none; padding-left: 0;">
                <li>✓ Comfortable, closed-toe shoes</li>
                <li>✓ Hair tie (if you have long hair)</li>
                <li>✓ Reviewed the location and parking information</li>
                <li>✓ Planned to arrive 15 minutes early</li>
                <li>✓ Our contact information for any last-minute issues</li>
              </ul>
            </div>

            <div class="card">
              <h3>Location & Parking</h3>
              <p>
                <strong>Empathy Soup Kitchen</strong><br>
                [Address will be provided separately]<br>
                <br>
                <strong>Parking:</strong> [Parking instructions]<br>
                <strong>Entry:</strong> Please use the volunteer entrance and check in at the front desk.
              </p>
            </div>

            <div class="card">
              <h3>Can't Make It?</h3>
              <p>If something unexpected comes up and you can't make your shift, please contact us <strong>immediately</strong> at:</p>
              <ul>
                <li><strong>Email:</strong> ${senderConfig.adminEmail}</li>
                <li><strong>Phone:</strong> [Emergency contact number]</li>
              </ul>
              <p>Early notice helps us find replacement volunteers and ensure we can still serve our community effectively.</p>
            </div>

            <div class="card">
              <p>Thank you for your dedication to serving our community. Your time and effort make a real difference in people's lives.</p>
              <p>See you tomorrow!</p>
              <p>Warm regards,<br>The Empathy Soup Kitchen Team</p>
            </div>
          </div>

          <div class="footer">
            <p>This email was sent to ${signup.Email}</p>
            <p>Empathy Soup Kitchen | Making a difference, one meal at a time</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Volunteer Shift Reminder

Your shift is in ${hoursUntilShift} hours!
Don't forget about your volunteer commitment tomorrow.

Hi ${signup.Name},

This is a friendly reminder about your upcoming volunteer shift with the Empathy Soup Kitchen. We're looking forward to having you join our team!

Your Shift Details:
- Date: ${shiftDate}
- Time: ${shiftTime}
- Number of People: ${signup.NumPeople}

Pre-Shift Checklist:
Please make sure you have:
✓ Comfortable, closed-toe shoes
✓ Hair tie (if you have long hair)
✓ Reviewed the location and parking information
✓ Planned to arrive 15 minutes early
✓ Our contact information for any last-minute issues

Location & Parking:
Empathy Soup Kitchen
[Address will be provided separately]

Parking: [Parking instructions]
Entry: Please use the volunteer entrance and check in at the front desk.

Can't Make It?
If something unexpected comes up and you can't make your shift, please contact us immediately at:
- Email: ${senderConfig.adminEmail}
- Phone: [Emergency contact number]

Early notice helps us find replacement volunteers and ensure we can still serve our community effectively.

Thank you for your dedication to serving our community. Your time and effort make a real difference in people's lives.

See you tomorrow!

Warm regards,
The Empathy Soup Kitchen Team

This email was sent to ${signup.Email}
Empathy Soup Kitchen | Making a difference, one meal at a time
    `.trim();

    return { subject, htmlContent, textContent };
  }
}