import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';
import { ToastService } from '../../shared/services/toast.service';
import { PledgeService } from './pledge.service';

@Component({
    selector: 'app-pledge',
    imports: [CommonModule, FormsModule, RouterLink, ScrollAnimateDirective],
    templateUrl: './pledge.component.html',
    styleUrl: './pledge.component.scss'
})
export class PledgeComponent {
  readonly presetAmounts = ['50', '100', '250', '500', '1000'];
  readonly contactEmail = 'info@empathysoupkitchen.org';
  readonly donateUrl = 'https://us.mohid.co/pa/pittsburgh/esk/masjid/online/donation';

  formData = {
    amount: '',
    amountOther: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    volunteer: '',
    frequency: '',
    frequencyOther: '',
    timing: '',
    timingDate: '',
    method: '',
    notes: '',
  };

  submitted = false;
  submitting = false;
  success = false;
  errorMessage = '';

  // Captured at submit time so the follow-up links survive a form reset.
  showVolunteerNext = false;
  showDonateNext = false;

  constructor(
    private pledgeService: PledgeService,
    private toastService: ToastService
  ) {}

  get amountInvalid(): boolean {
    if (!this.formData.amount) return true;
    return this.formData.amount === 'other' && !this.formData.amountOther.trim();
  }

  get emailInvalid(): boolean {
    const email = this.formData.email.trim();
    return !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.errorMessage = '';

    if (
      this.amountInvalid ||
      !this.formData.name.trim() ||
      !this.formData.phone.trim() ||
      this.emailInvalid
    ) {
      return;
    }

    this.submitting = true;

    try {
      await this.pledgeService.submitPledge({
        amount: this.resolvedAmount(),
        amountValue: this.numericAmount(),
        name: this.formData.name.trim(),
        phone: this.formData.phone.trim(),
        email: this.formData.email.trim(),
        address: this.formData.address.trim(),
        volunteer: this.labelFor(this.formData.volunteer, {
          yes: 'Yes',
          later: 'Maybe later',
        }),
        frequency: this.resolvedFrequency(),
        timing: this.resolvedTiming(),
        method: this.labelFor(this.formData.method, {
          check: 'Check',
          online: 'Online',
          cash: 'Cash',
        }),
        notes: this.formData.notes.trim(),
      });

      this.showVolunteerNext = this.formData.volunteer === 'yes';
      this.showDonateNext = this.formData.method === 'online';
      this.success = true;
      this.toastService.success('Thank you! Your pledge has been submitted.');
    } catch (error: any) {
      this.errorMessage =
        'We could not submit your pledge right now. Please try again, or email us directly.';
      console.error('Pledge submission failed:', error);
    } finally {
      this.submitting = false;
    }
  }

  resetForm(): void {
    this.formData = {
      amount: '',
      amountOther: '',
      name: '',
      phone: '',
      email: '',
      address: '',
      volunteer: '',
      frequency: '',
      frequencyOther: '',
      timing: '',
      timingDate: '',
      method: '',
      notes: '',
    };
    this.submitted = false;
    this.success = false;
    this.errorMessage = '';
    this.showVolunteerNext = false;
    this.showDonateNext = false;
  }

  private resolvedAmount(): string {
    if (this.formData.amount === 'other') {
      // Strip any currency symbol the donor typed so the label isn't "$$100".
      const entered = this.formData.amountOther.trim().replace(/^\$+\s*/, '');
      return `$${entered} (other)`;
    }
    return `$${this.formData.amount}`;
  }

  /** Numeric value used for cumulative reporting; 0 when a free-text amount can't be parsed. */
  private numericAmount(): number {
    const raw =
      this.formData.amount === 'other'
        ? this.formData.amountOther.replace(/[^0-9.]/g, '')
        : this.formData.amount;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private resolvedFrequency(): string {
    if (this.formData.frequency === 'other') {
      return this.formData.frequencyOther.trim() || 'Other';
    }
    return this.labelFor(this.formData.frequency, {
      once: 'One time',
      monthly: 'Monthly',
    });
  }

  private resolvedTiming(): string {
    if (this.formData.timing === 'date') {
      return this.formData.timingDate
        ? `On ${this.formData.timingDate}`
        : 'On a future date';
    }
    return this.labelFor(this.formData.timing, { today: 'Today' });
  }

  private labelFor(value: string, labels: Record<string, string>): string {
    return value ? labels[value] ?? value : '';
  }
}
