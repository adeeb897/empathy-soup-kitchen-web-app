import { Component, OnInit } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { CommonModule } from '@angular/common';

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
    MatExpansionModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'empathy-soup-kitchen-web-app';
  opened = false;
  currentYear = new Date().getFullYear();
  financialYears: string[] = [];

  ngOnInit() {
    this.generateFinancialYears();
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
}
