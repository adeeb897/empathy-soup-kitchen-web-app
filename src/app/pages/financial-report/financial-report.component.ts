import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';
import { SafePipe } from '../../pipes/safe.pipe';

interface FinancialReport {
  year: string;
  quarter: number;
  label: string;
  url: string;
  available: boolean;
}

@Component({
    selector: 'app-financial-report',
    imports: [CommonModule, ScrollAnimateDirective, SafePipe],
    templateUrl: './financial-report.component.html',
    styleUrl: './financial-report.component.scss'
})
export class FinancialReportComponent implements OnInit {
  readonly annualReportUrl = 'https://eskupdates.pages.dev/';

  reports: FinancialReport[] = [];
  selectedReport: FinancialReport | null = null;
  openYears: Set<string> = new Set();
  loading = true;

  ngOnInit(): void {
    this.buildReportList();
  }

  private async buildReportList(): Promise<void> {
    const years = ['2024', '2023'];
    const candidates: FinancialReport[] = [];
    for (const year of years) {
      const quarters = year === '2024' ? [4] : [1, 2, 3, 4];
      for (const q of quarters) {
        candidates.push({
          year,
          quarter: q,
          label: `Q${q} ${year}`,
          url: `assets/pdfs/financial-${year}-q${q}.pdf`,
          available: false,
        });
      }
    }

    const checks = await Promise.all(
      candidates.map(async (report) => {
        try {
          const res = await fetch(report.url, { method: 'HEAD' });
          return { ...report, available: res.ok && (res.headers.get('content-type')?.includes('pdf') ?? false) };
        } catch {
          return report;
        }
      })
    );

    this.reports = checks.filter((r) => r.available);
    this.loading = false;

    const firstYear = this.uniqueYears[0];
    if (firstYear) {
      this.openYears.add(firstYear);
    }
  }

  getReportsForYear(year: string): FinancialReport[] {
    return this.reports.filter((r) => r.year === year);
  }

  get uniqueYears(): string[] {
    return [...new Set(this.reports.map((r) => r.year))];
  }

  toggleYear(year: string): void {
    if (this.openYears.has(year)) {
      this.openYears.delete(year);
    } else {
      this.openYears.add(year);
    }
  }

  isYearOpen(year: string): boolean {
    return this.openYears.has(year);
  }

  viewReport(report: FinancialReport): void {
    this.selectedReport = report;
  }

  closeReportViewer(): void {
    this.selectedReport = null;
  }
}
