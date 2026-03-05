import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  selector: 'app-get-involved',
  standalone: true,
  imports: [CommonModule, RouterLink, ScrollAnimateDirective, SafePipe],
  templateUrl: './get-involved.component.html',
  styleUrl: './get-involved.component.scss',
})
export class GetInvolvedComponent implements OnInit {
  activeTab = 'donate';

  tabs = [
    { id: 'donate', label: 'Donate', icon: 'favorite' },
    { id: 'refugee', label: 'Refugee Services', icon: 'public' },
    { id: 'reports', label: 'Financial Reports', icon: 'description' },
  ];

  shoppingList = [
    'Trash Bags (35-55 gallon)',
    'Ziplock Bags',
    'Dish Soap',
    'Powder Drink Mix',
    'Canned Milk',
    'Sugar',
    'Canned Fruit & Apple Sauce',
    'Aluminum Foil',
    'Freezer Bags',
    'Packaged Cookies',
  ];

  reports: FinancialReport[] = [];
  selectedReport: FinancialReport | null = null;
  openYears: Set<string> = new Set();

  ngOnInit(): void {
    this.buildReportList();
  }

  private buildReportList(): void {
    const years = ['2024', '2023'];
    for (const year of years) {
      const quarters = year === '2024' ? [4] : [1, 2, 3, 4];
      for (const q of quarters) {
        this.reports.push({
          year,
          quarter: q,
          label: `Q${q} ${year}`,
          url: `assets/pdfs/financial-${year}-q${q}.pdf`,
          available: true, // Will check at runtime
        });
      }
    }
    // Open the most recent year by default
    if (years.length > 0) {
      this.openYears.add(years[0]);
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

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }
}
