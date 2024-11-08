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
    path: 'who-we-are',
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
  { path: '**', redirectTo: '/home' },
];
