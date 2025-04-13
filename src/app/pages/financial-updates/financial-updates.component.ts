import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { SafePipeModule } from '../../pipes/safe.pipe';
import { catchError, forkJoin, map, of } from 'rxjs';
import { PdfViewerModule } from 'ng2-pdf-viewer';

interface FinancialReport {
  title: string;
  year: string;
  quarter: string;
  pdfUrl: string;
  displayName: string;
  type: 'quarterly' | 'annual' | 'other';
}

@Component({
  selector: 'app-financial-updates',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PdfViewerModule,
    SafePipeModule,
  ],
  templateUrl: './financial-updates.component.html',
  styleUrls: ['./financial-updates.component.scss'],
})
export class FinancialUpdatesComponent implements OnInit {
  reports: FinancialReport[] = [];
  selectedReport: FinancialReport | null = null;
  loading = true;
  error = '';

  // Define patterns to search for
  private readonly patterns = [
    // Quarterly reports for recent years
    { pattern: 'financial-{year}-q{quarter}.pdf', years: 5, type: 'quarterly' },
    // // Annual reports
    // { pattern: 'annual-report-{year}.pdf', years: 5, type: 'annual' },
    // // Budget proposals
    // { pattern: 'budget-proposal-{year}.pdf', years: 5, type: 'annual' },
    // // Fundraising summaries
    // { pattern: 'fundraising-summary-{year}.pdf', years: 5, type: 'annual' },
  ];

  constructor(private http: HttpClient) {}

  // Add a helper method to safely check if a report is selected
  isReportSelected(report: FinancialReport): boolean {
    if (!this.selectedReport) return false;
    return this.selectedReport.pdfUrl === report.pdfUrl;
  }

  ngOnInit() {
    this.discoverPdfFiles();
  }

  discoverPdfFiles() {
    this.loading = true;

    // Generate a list of possible filenames based on patterns
    const possibleFiles = this.generatePossibleFilenames();

    // Check if each file exists
    const requests = possibleFiles.map((file) => {
      return this.http
        .head(`assets/pdfs/${file}`, { observe: 'response' })
        .pipe(
          map(() => file), // If successful, return the filename
          catchError(() => of(null)) // If error, return null
        );
    });

    // Process all the requests together
    forkJoin(requests).subscribe({
      next: (results) => {
        // Filter out null results and process found files
        const foundFiles = results.filter(Boolean) as string[];
        this.processFoundFiles(foundFiles);
        this.loading = false;
      },
      error: () => {
        this.error = 'Error discovering PDF files';
        this.loading = false;
      },
    });
  }

  generatePossibleFilenames(): string[] {
    const files: string[] = [];
    const currentYear = new Date().getFullYear();

    // Generate filenames for each pattern
    this.patterns.forEach((patternInfo) => {
      const { pattern, years } = patternInfo;

      // Generate for X years back
      for (let i = 0; i < years; i++) {
        const year = currentYear - i;

        // If pattern includes quarter, generate for each quarter
        if (pattern.includes('{quarter}')) {
          for (let quarter = 1; quarter <= 4; quarter++) {
            const filename = pattern
              .replace('{year}', year.toString())
              .replace('{quarter}', quarter.toString());
            files.push(filename);
          }
        } else {
          // Otherwise just use the year
          const filename = pattern.replace('{year}', year.toString());
          files.push(filename);
        }
      }
    });

    return files;
  }

  processFoundFiles(files: string[]) {
    this.reports = files.map((file) => {
      // Determine type and extract info
      let reportType: 'quarterly' | 'annual' | 'other' = 'other';
      let title = '';
      let year = '';
      let quarter = '';
      let displayName = '';

      // Process quarterly reports
      const quarterlyMatch = file.match(/financial-(\d{4})-Q(\d)\.pdf/i);
      if (quarterlyMatch) {
        reportType = 'quarterly';
        year = quarterlyMatch[1];
        quarter = quarterlyMatch[2];

        const quarterMap: { [key: string]: string } = {
          '1': 'First Quarter',
          '2': 'Second Quarter',
          '3': 'Third Quarter',
          '4': 'Fourth Quarter',
        };

        title = quarterMap[quarter] || `Q${quarter}`;
        displayName = `${title} ${year}`;
      }

      // Process annual reports
      else if (file.match(/annual-report-(\d{4})\.pdf/i)) {
        reportType = 'annual';
        year = file.match(/annual-report-(\d{4})\.pdf/i)![1];
        title = 'Annual Report';
        displayName = `${title} ${year}`;
      }

      // Process budget proposals
      else if (file.match(/budget-proposal-(\d{4})\.pdf/i)) {
        reportType = 'other';
        year = file.match(/budget-proposal-(\d{4})\.pdf/i)![1];
        title = 'Budget Proposal';
        displayName = `${title} ${year}`;
      }

      // Process fundraising summaries
      else if (file.match(/fundraising-summary-(\d{4})\.pdf/i)) {
        reportType = 'other';
        year = file.match(/fundraising-summary-(\d{4})\.pdf/i)![1];
        title = 'Fundraising Summary';
        displayName = `${title} ${year}`;
      }

      // Generic fallback for other files
      else {
        title = file
          .replace(/\.pdf$/i, '')
          .split(/[-_]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        displayName = title;
      }

      return {
        title,
        year,
        quarter,
        pdfUrl: `assets/pdfs/${file}`,
        displayName,
        type: reportType,
      };
    });

    // Sort reports by year (descending) and quarter (descending)
    this.reports.sort((a, b) => {
      // First by type - quarterly reports come before others
      if (a.type !== b.type) {
        if (a.type === 'quarterly') return -1;
        if (b.type === 'quarterly') return 1;
        if (a.type === 'annual') return -1;
        if (b.type === 'annual') return 1;
      }

      // Then by year
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year);
      }

      // Then by quarter for quarterly reports
      if (a.type === 'quarterly' && b.type === 'quarterly') {
        return b.quarter.localeCompare(a.quarter);
      }

      // Default sort by title
      return a.title.localeCompare(b.title);
    });

    // Select the first report if available
    if (this.reports.length > 0) {
      this.selectedReport = this.reports[0];
    }
  }

  viewReport(report: FinancialReport): void {
    this.selectedReport = report;
  }
}
