import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    HttpClientModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'empathy-soup-kitchen-web-app';
  opened = false;
  currentYear = new Date().getFullYear();
  financialYears: string[] = [];
  availableReports: { [key: string]: boolean } = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.generateFinancialYears();
    this.checkAvailableReports();
  }

  toggleSidenav() {
    this.opened = !this.opened;
  }

  generateFinancialYears() {
    // Only include years from 2024 onwards
    this.financialYears = [];
    const startYear = Math.max(2024, this.currentYear);
    
    for (let year = startYear; year >= 2024; year--) {
      this.financialYears.push(year.toString());
    }
  }

  checkAvailableReports() {
    // Check all possible reports for availability
    this.financialYears.forEach(year => {
      const quarters = year === '2024' ? [4] : [1, 2, 3, 4];
      
      quarters.forEach(quarter => {
        const reportKey = `${year}-q${quarter}`;
        const reportUrl = `assets/pdfs/financial-${reportKey}.pdf`;
        
        this.http.head(reportUrl)
          .subscribe({
            next: () => {
              // Report exists
              this.availableReports[reportKey] = true;
            },
            error: () => {
              // Report doesn't exist
              this.availableReports[reportKey] = false;
            }
          });
      });
    });
  }

  isReportAvailable(year: string, quarter: number): boolean {
    const reportKey = `${year}-q${quarter}`;
    return this.availableReports[reportKey] === true;
  }
}
