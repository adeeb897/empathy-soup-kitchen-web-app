import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { catchError, map, of } from 'rxjs';

@Component({
  selector: 'app-financial-report',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PdfViewerModule,
    RouterLink
  ],
  templateUrl: './financial-report.component.html',
  styleUrls: ['./financial-report.component.scss']
})
export class FinancialReportComponent implements OnInit {
  year: string = '';
  quarter: string = '';
  reportUrl: string = '';
  loading = true;
  error = '';
  reportExists = false;
  quarterNames: { [key: string]: string } = {
    '1': 'First Quarter',
    '2': 'Second Quarter',
    '3': 'Third Quarter',
    '4': 'Fourth Quarter'
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.year = params.get('year') || '';
      this.quarter = params.get('quarter') || '';
      
      if (!this.year || !this.quarter) {
        this.router.navigate(['/home']);
        return;
      }
      
      this.checkReportExists();
    });
  }
  
  getQuarterName(): string {
    return this.quarterNames[this.quarter] || `Quarter ${this.quarter}`;
  }
  
  getReportName(): string {
    return `${this.getQuarterName()} ${this.year} Financial Report`;
  }
  
  checkReportExists() {
    this.loading = true;
    this.error = '';
    this.reportExists = false;
    
    const filename = `financial-${this.year}-q${this.quarter}.pdf`;
    this.reportUrl = `../../assets/pdfs/${filename}`;
    
    this.http.get(this.reportUrl, { 
      responseType: 'blob',
      observe: 'response' 
    }).pipe(
      map(response => {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/pdf')) {
          return true;
        } else {
          return false;
        }
      }),
      catchError(err => {
        console.warn(`Financial report not found: ${filename}`, err);
        return of(false);
      })
    ).subscribe(exists => {
      this.reportExists = exists;
      this.loading = false;
      
      if (!exists) {
        this.error = `No financial report is available for ${this.getQuarterName()} ${this.year}.`;
      }
    });
  }
}
