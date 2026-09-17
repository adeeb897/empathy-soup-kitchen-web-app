import { Routes } from '@angular/router';


export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'volunteer',
    loadComponent: () =>
      import('./pages/volunteer/volunteer.component').then(
        (m) => m.VolunteerComponent
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./pages/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'shifts', pathMatch: 'full' },
      {
        path: 'shifts',
        loadComponent: () =>
          import('./pages/admin/shifts/admin-shifts.component').then(
            (m) => m.AdminShiftsComponent
          ),
      },
      {
        path: 'pledges',
        loadComponent: () =>
          import('./pages/admin/pledges/admin-pledges.component').then(
            (m) => m.AdminPledgesComponent
          ),
      },
    ],
  },
  {
    path: 'get-involved',
    loadComponent: () =>
      import('./pages/get-involved/get-involved.component').then(
        (m) => m.GetInvolvedComponent
      ),
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./pages/gallery/gallery.component').then(
        (m) => m.GalleryComponent
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'fundraiser',
    loadComponent: () =>
      import('./pages/fundraiser/fundraiser.component').then((m) => m.FundraiserComponent),
  },
  {
    path: 'pledge',
    loadComponent: () =>
      import('./pages/pledge/pledge.component').then((m) => m.PledgeComponent),
  },
  {
    path: 'financial-report',
    loadComponent: () =>
      import('./pages/financial-report/financial-report.component').then(
        (m) => m.FinancialReportComponent
      ),
  },

  // Legacy redirects
  { path: 'calendar/admin', redirectTo: '/admin', pathMatch: 'full' },
  { path: 'volunteer/admin', redirectTo: '/admin', pathMatch: 'full' },
  { path: 'calendar', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'donate', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'donations', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'picture-gallery', redirectTo: '/gallery', pathMatch: 'full' },
  { path: 'who-we-are', redirectTo: '/about', pathMatch: 'full' },
  { path: 'faqs', redirectTo: '/about', pathMatch: 'full' },
  { path: 'refugee-services', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'volunteers', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'financial-report/:year/:quarter', redirectTo: '/financial-report', pathMatch: 'full' },
  { path: 'financial-reports', redirectTo: '/financial-report', pathMatch: 'full' },
  { path: 'soup-kitchen-tasks', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'refugee-tasks', redirectTo: '/get-involved', pathMatch: 'full' },

  // Catch-all
  { path: '**', redirectTo: '/home' },
];
