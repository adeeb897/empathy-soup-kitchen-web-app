import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { PledgeService, PledgeRecord } from '../../pledge/pledge.service';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

@Component({
  selector: 'app-admin-pledges',
  standalone: true,
  imports: [CommonModule, StatePanelComponent],
  templateUrl: './admin-pledges.component.html',
  styleUrl: './admin-pledges.component.scss',
})
export class AdminPledgesComponent implements OnInit {
  pledges: PledgeRecord[] = [];
  pledgesLoading = false;
  pledgesError = '';

  constructor(
    private pledgeService: PledgeService,
    private toastService: ToastService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadPledges();
  }

  get totalPledged(): number {
    return this.pledges.reduce((sum, p) => sum + (Number(p.Amount) || 0), 0);
  }

  get averagePledge(): number {
    return this.pledges.length ? this.totalPledged / this.pledges.length : 0;
  }

  get monthlyPledgeCount(): number {
    return this.pledges.filter((p) => p.Frequency === 'Monthly').length;
  }

  async loadPledges(): Promise<void> {
    this.pledgesLoading = true;
    this.pledgesError = '';
    try {
      this.pledges = await this.pledgeService.getPledges();
    } catch (error: any) {
      const message = String(error?.message ?? '');
      this.pledgesError = /401|403/.test(message)
        ? 'Your session has expired. Please sign out and sign in again to view pledges.'
        : 'Could not load pledges. Please try again.';
      console.error('Failed to load pledges:', error);
    } finally {
      this.pledgesLoading = false;
    }
  }

  async deletePledge(pledgeId: number): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this pledge?',
      message: 'This removes the record permanently and cannot be undone.',
      confirmLabel: 'Delete pledge',
    });
    if (!ok) return;
    try {
      await this.pledgeService.deletePledge(pledgeId);
      this.pledges = this.pledges.filter((p) => p.PledgeID !== pledgeId);
      this.toastService.success('Pledge deleted');
    } catch (error) {
      this.toastService.error('Failed to delete pledge');
      console.error('Failed to delete pledge:', error);
    }
  }
}
