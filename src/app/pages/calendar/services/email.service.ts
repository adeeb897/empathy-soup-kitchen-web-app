import { Injectable } from '@angular/core';
import { VolunteerShift, SignUp } from '../models/volunteer.model';
import { RetryService } from '../../../shared/utils/retry.service';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private readonly endpoint = '/api/email/send';
  private readonly senderName = 'Empathy Soup Kitchen';
  private readonly adminEmail = this.getConfig('EMAIL_ADMIN_EMAIL', 'admin@empathysoupkitchen.org');

  constructor(private retryService: RetryService) {}

  async sendSignupConfirmation(shift: VolunteerShift, signup: SignUp): Promise<void> {
    const shiftDate = this.formatDate(shift.StartTime);
    const shiftTime = this.formatTimeRange(shift);

    await this.sendEmail({
      to: signup.Email,
      subject: `Volunteer Shift Confirmation - ${shiftDate}`,
      type: 'confirmation',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#2e7d32;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px">Thank You for Volunteering!</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <p>Hi ${signup.Name},</p>
            <p>Thank you for signing up to volunteer with the Empathy Soup Kitchen!</p>
            <div style="background:#e8f5e8;padding:16px;border-left:4px solid #2e7d32;margin:16px 0">
              <h3 style="margin:0 0 8px;color:#2e7d32">Your Shift Details</h3>
              <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
              <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
              <p style="margin:4px 0"><strong>People:</strong> ${signup.NumPeople}</p>
            </div>
            <p>Please arrive 15 minutes before your scheduled time.</p>
            <h3>Location</h3>
            <p>Empathy Soup Kitchen<br>523 Sinclair Street<br>McKeesport, PA 15132</p>
            <h3>Need to Cancel?</h3>
            <p>Visit our <strong>Volunteer Shifts</strong> page and use the "Cancel My Signup" section with your email address and name.</p>
            <p>Warm regards,<br>The Empathy Soup Kitchen Team</p>
          </div>
        </div>
      `,
      text: `Thank You for Volunteering!\n\nHi ${signup.Name},\n\nThank you for signing up to volunteer with the Empathy Soup Kitchen!\n\nYour Shift Details:\n- Date: ${shiftDate}\n- Time: ${shiftTime}\n- People: ${signup.NumPeople}\n\nPlease arrive 15 minutes before your scheduled time.\n\nLocation:\nEmpathy Soup Kitchen\n523 Sinclair Street\nMcKeesport, PA 15132\n\nNeed to Cancel?\nVisit our Volunteer Shifts page and use the "Cancel My Signup" section with your email address and name.\n\nWarm regards,\nThe Empathy Soup Kitchen Team`
    });
  }

  async sendSignupAdminNotification(shift: VolunteerShift, signup: SignUp): Promise<void> {
    const shiftDate = this.formatDate(shift.StartTime);
    const shiftTime = this.formatTimeRange(shift);
    const filledSlots = (shift.signups?.reduce((t, s) => t + s.NumPeople, 0) || 0) + signup.NumPeople;
    const remaining = shift.Capacity - filledSlots;

    await this.sendEmail({
      to: this.adminEmail,
      subject: `New Volunteer Signup - ${signup.Name} (${shiftDate})`,
      type: 'admin_signup_notification',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1565c0;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px">New Volunteer Signup</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <div style="background:#e8f5e8;padding:16px;border-left:4px solid #2e7d32;margin:0 0 16px">
              <h3 style="margin:0 0 8px;color:#2e7d32">Volunteer</h3>
              <p style="margin:4px 0"><strong>Name:</strong> ${signup.Name}</p>
              <p style="margin:4px 0"><strong>Email:</strong> ${signup.Email}</p>
              <p style="margin:4px 0"><strong>Phone:</strong> ${signup.PhoneNumber}</p>
              <p style="margin:4px 0"><strong>People:</strong> ${signup.NumPeople}</p>
            </div>
            <div style="background:#e3f2fd;padding:16px;border-left:4px solid #1565c0;margin:0 0 16px">
              <h3 style="margin:0 0 8px;color:#1565c0">Shift</h3>
              <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
              <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
              <p style="margin:4px 0"><strong>Capacity:</strong> ${filledSlots} / ${shift.Capacity} (${remaining} remaining)</p>
            </div>
            ${remaining <= 3 ? '<p style="color:#e65100;font-weight:bold">This shift is nearly full!</p>' : ''}
          </div>
        </div>
      `,
      text: `New Volunteer Signup\n\nVolunteer: ${signup.Name}\nEmail: ${signup.Email}\nPhone: ${signup.PhoneNumber}\nPeople: ${signup.NumPeople}\n\nShift: ${shiftDate}, ${shiftTime}\nCapacity: ${filledSlots} / ${shift.Capacity} (${remaining} remaining)${remaining <= 3 ? '\n\nThis shift is nearly full!' : ''}`
    });
  }

  async sendCancellationConfirmation(shift: VolunteerShift, signup: SignUp): Promise<void> {
    const shiftDate = this.formatDate(shift.StartTime);
    const shiftTime = this.formatTimeRange(shift);

    await this.sendEmail({
      to: signup.Email,
      subject: `Volunteer Shift Cancellation - ${shiftDate}`,
      type: 'cancellation_confirmation',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#e65100;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px">Signup Cancelled</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <p>Hi ${signup.Name},</p>
            <p>Your volunteer signup has been cancelled for the following shift:</p>
            <div style="background:#fff3e0;padding:16px;border-left:4px solid #e65100;margin:16px 0">
              <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
              <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
              <p style="margin:4px 0"><strong>People:</strong> ${signup.NumPeople}</p>
            </div>
            <p>If this was a mistake, you can sign up again on our Volunteer Shifts page.</p>
            <p>Thank you,<br>The Empathy Soup Kitchen Team</p>
          </div>
        </div>
      `,
      text: `Signup Cancelled\n\nHi ${signup.Name},\n\nYour volunteer signup has been cancelled for the following shift:\n\n- Date: ${shiftDate}\n- Time: ${shiftTime}\n- People: ${signup.NumPeople}\n\nIf this was a mistake, you can sign up again on our Volunteer Shifts page.\n\nThank you,\nThe Empathy Soup Kitchen Team`
    });
  }

  async sendCancellationAdminNotification(shift: VolunteerShift, signup: SignUp): Promise<void> {
    const shiftDate = this.formatDate(shift.StartTime);
    const shiftTime = this.formatTimeRange(shift);
    const filledSlots = Math.max(0, (shift.signups?.reduce((t, s) => t + s.NumPeople, 0) || 0) - signup.NumPeople);
    const remaining = shift.Capacity - filledSlots;

    await this.sendEmail({
      to: this.adminEmail,
      subject: `Volunteer Cancellation - ${signup.Name} (${shiftDate})`,
      type: 'admin_cancellation_notification',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#c62828;color:#fff;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h1 style="margin:0;font-size:24px">Volunteer Cancellation</h1>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 8px 8px">
            <div style="background:#ffebee;padding:16px;border-left:4px solid #c62828;margin:0 0 16px">
              <h3 style="margin:0 0 8px;color:#c62828">Cancelled Volunteer</h3>
              <p style="margin:4px 0"><strong>Name:</strong> ${signup.Name}</p>
              <p style="margin:4px 0"><strong>Email:</strong> ${signup.Email}</p>
              <p style="margin:4px 0"><strong>Phone:</strong> ${signup.PhoneNumber}</p>
              <p style="margin:4px 0"><strong>People:</strong> ${signup.NumPeople}</p>
            </div>
            <div style="background:#e3f2fd;padding:16px;border-left:4px solid #1565c0">
              <h3 style="margin:0 0 8px;color:#1565c0">Shift</h3>
              <p style="margin:4px 0"><strong>Date:</strong> ${shiftDate}</p>
              <p style="margin:4px 0"><strong>Time:</strong> ${shiftTime}</p>
              <p style="margin:4px 0"><strong>Updated Capacity:</strong> ${filledSlots} / ${shift.Capacity} (${remaining} remaining)</p>
            </div>
          </div>
        </div>
      `,
      text: `Volunteer Cancellation\n\nCancelled: ${signup.Name}\nEmail: ${signup.Email}\nPhone: ${signup.PhoneNumber}\nPeople: ${signup.NumPeople}\n\nShift: ${shiftDate}, ${shiftTime}\nUpdated Capacity: ${filledSlots} / ${shift.Capacity} (${remaining} remaining)`
    });
  }

  private async sendEmail(data: EmailData): Promise<void> {
    try {
      const response = await this.retryService.fetchWithRetry(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Email send failed (${response.status}):`, errorText);
        return;
      }

      const result = await response.json();
      if (!result.success) {
        console.error('Email send failed:', result.error);
      }
    } catch (error) {
      console.error('Email send error:', error);
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  private formatTimeRange(shift: VolunteerShift): string {
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${fmt(shift.StartTime)} - ${fmt(shift.EndTime)}`;
  }

  private getConfig(key: string, fallback: string): string {
    if (typeof window !== 'undefined') {
      const config = (window as any).EMAIL_CONFIG;
      if (config?.[key]) return config[key];
    }
    return fallback;
  }
}
