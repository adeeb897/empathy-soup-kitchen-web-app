import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  {
    path: 'donations',
    loadComponent: () =>
      import('./pages/donations/donations.component').then(
        (m) => m.DonationsComponent
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/who-we-are/who-we-are.component').then(
        (m) => m.WhoWeAreComponent
      ),
  },
  {
    path: 'volunteers',
    loadComponent: () =>
      import('./pages/volunteers/volunteers.component').then(
        (m) => m.VolunteersComponent
      ),
  },
  {
    path: 'faqs',
    loadComponent: () =>
      import('./pages/faqs/faqs.component').then((m) => m.FaqsComponent),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./pages/calendar/calendar.component').then(
        (m) => m.CalendarComponent
      ),
  },
  {
    path: 'calendar/admin',
    loadComponent: () =>
      import('./pages/calendar/admin/admin.component').then(
        (m) => m.AdminComponent
      ),
    canActivate: [
      () => import('./pages/calendar/guards/admin-auth.guard').then(m => m.AdminAuthGuard)
    ]
  },
  {
    path: 'financial-report/:year/:quarter',
    loadComponent: () =>
      import('./pages/financial-report/financial-report.component').then(
        (m) => m.FinancialReportComponent
      ),
  },
  {
    path: 'refugee-services',
    loadComponent: () =>
      import('./pages/refugee-services/refugee-services.component').then(
        (m) => m.RefugeeServicesComponent
      ),
  },
  {
    path: 'soup-kitchen-tasks',
    loadComponent: () =>
      import('./pages/soup-kitchen-tasks/soup-kitchen-tasks.component').then(
        (m) => m.SoupKitchenTasksComponent
      ),
  },
  {
    path: 'refugee-tasks',
    loadComponent: () =>
      import('./pages/refugee-tasks/refugee-tasks.component').then(
        (m) => m.RefugeeTasksComponent
      ),
  },
  {
    path: 'picture-gallery',
    loadComponent: () =>
      import('./pages/picture-gallery/picture-gallery.component').then(
        (m) => m.PictureGalleryComponent
      ),
  },
  { path: '**', redirectTo: '/home' },
];
