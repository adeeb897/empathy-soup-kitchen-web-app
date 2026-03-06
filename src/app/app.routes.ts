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
    path: 'volunteer/admin',
    loadComponent: () =>
      import('./pages/volunteer-admin/volunteer-admin.component').then(
        (m) => m.VolunteerAdminComponent
      ),
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

  // Legacy redirects
  { path: 'calendar/admin', redirectTo: '/volunteer/admin', pathMatch: 'full' },
  { path: 'calendar', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'donate', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'donations', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'picture-gallery', redirectTo: '/gallery', pathMatch: 'full' },
  { path: 'who-we-are', redirectTo: '/about', pathMatch: 'full' },
  { path: 'faqs', redirectTo: '/about', pathMatch: 'full' },
  { path: 'refugee-services', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'volunteers', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'financial-report/:year/:quarter', redirectTo: '/get-involved', pathMatch: 'full' },
  { path: 'soup-kitchen-tasks', redirectTo: '/volunteer', pathMatch: 'full' },
  { path: 'refugee-tasks', redirectTo: '/get-involved', pathMatch: 'full' },

  // Catch-all
  { path: '**', redirectTo: '/home' },
];
