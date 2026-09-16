import { Injectable } from '@angular/core';
import { RetryService } from '../../shared/utils/retry.service';

export interface PledgeSubmission {
  amount: string;
  amountValue: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  volunteer: string;
  frequency: string;
  timing: string;
  method: string;
  notes: string;
}

export interface PledgeRecord {
  PledgeID: number;
  Amount: number;
  AmountLabel: string | null;
  Name: string;
  Email: string;
  PhoneNumber: string | null;
  Address: string | null;
  VolunteerInterest: string | null;
  Frequency: string | null;
  Timing: string | null;
  PaymentMethod: string | null;
  Notes: string | null;
  SubmittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PledgeService {
  private readonly emailEndpoint = '/api/email/send';
  private readonly pledgesEndpoint = '/api/pledges';
  private readonly recipient = 'info@empathysoupkitchen.org';

  constructor(private retryService: RetryService) {}

  /**
   * Saves the pledge, then notifies staff by email. The record is saved first so
   * a mail outage cannot lose the pledge; a failed notification is logged but
   * does not fail the submission.
   */
  async submitPledge(pledge: PledgeSubmission): Promise<void> {
    await this.savePledge(pledge);

    try {
      await this.sendNotification(pledge);
    } catch (error) {
      console.warn('Pledge saved, but notification email failed:', error);
    }
  }

  async getPledges(): Promise<PledgeRecord[]> {
    const response = await this.retryService.fetchWithRetry(this.pledgesEndpoint, {
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to load pledges: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.value) ? data.value : [];
  }

  async deletePledge(pledgeId: number): Promise<void> {
    const response = await this.retryService.fetchWithRetry(
      `${this.pledgesEndpoint}/${pledgeId}`,
      { method: 'DELETE', headers: this.authHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to delete pledge: ${response.status}`);
    }
  }

  /**
   * Reads the admin session token stored by AdminAuthService. Reading it here
   * rather than injecting the service keeps this service usable from the public
   * pledge form, which has no admin session.
   */
  private authHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem('esk_admin_session');
      if (!raw) return {};
      const session = JSON.parse(raw);
      return session?.sessionToken
        ? { Authorization: `Bearer ${session.sessionToken}` }
        : {};
    } catch {
      return {};
    }
  }

  private async savePledge(pledge: PledgeSubmission): Promise<void> {
    const response = await this.retryService.fetchWithRetry(this.pledgesEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Amount: pledge.amountValue,
        AmountLabel: pledge.amount,
        Name: pledge.name,
        Email: pledge.email,
        PhoneNumber: pledge.phone,
        Address: pledge.address,
        VolunteerInterest: pledge.volunteer,
        Frequency: pledge.frequency,
        Timing: pledge.timing,
        PaymentMethod: pledge.method,
        Notes: pledge.notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
  }

  private async sendNotification(pledge: PledgeSubmission): Promise<void> {
    const response = await this.retryService.fetchWithRetry(this.emailEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: this.recipient,
        subject: `New Pledge Form Submission — ${pledge.name}`,
        html: this.buildHtml(pledge),
        text: this.buildText(pledge),
        type: 'pledge_submission',
      }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Email service rejected the submission');
    }
  }

  /** Escapes user-supplied values before they are placed into the email markup. */
  private escape(value: string): string {
    return (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private rows(pledge: PledgeSubmission): Array<[string, string]> {
    return [
      ['Pledge Amount', pledge.amount],
      ['Name', pledge.name],
      ['Phone', pledge.phone],
      ['Email', pledge.email],
      ['Address', pledge.address],
      ['Interested in volunteering', pledge.volunteer],
      ['Donation frequency', pledge.frequency],
      ['Donation timing', pledge.timing],
      ['Payment method', pledge.method],
      ['Notes', pledge.notes],
    ].filter(([, value]) => !!value) as Array<[string, string]>;
  }

  private buildHtml(pledge: PledgeSubmission): string {
    const rows = this.rows(pledge)
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#3B2F2A;white-space:nowrap;">${this.escape(
              label
            )}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#4A3F38;">${this.escape(
              value
            )}</td>
          </tr>`
      )
      .join('');

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#BF6B3F;margin-bottom:4px;">New Pledge Form Submission</h2>
        <p style="color:#7D7068;margin-top:0;">Submitted ${new Date().toLocaleString()}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">${rows}</table>
        <p style="color:#7D7068;font-size:12px;margin-top:24px;">
          Sent automatically from the Empathy Soup Kitchen pledge form.
        </p>
      </div>`;
  }

  private buildText(pledge: PledgeSubmission): string {
    const lines = this.rows(pledge).map(([label, value]) => `${label}: ${value}`);
    return [
      'New Pledge Form Submission',
      `Submitted ${new Date().toLocaleString()}`,
      '',
      ...lines,
    ].join('\n');
  }
}
