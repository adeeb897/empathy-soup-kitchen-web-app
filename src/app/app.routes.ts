import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { 
    path: 'fundraising', 
    loadComponent: () => import('./pages/fundraising/fundraising.component').then(m => m.FundraisingComponent)
  },
  { path: 'who-we-are', loadComponent: () => import('./pages/who-we-are/who-we-are.component').then(m => m.WhoWeAreComponent) },
  { path: 'volunteers', loadComponent: () => import('./pages/volunteers/volunteers.component').then(m => m.VolunteersComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent) },
  { path: 'faqs', loadComponent: () => import('./pages/faqs/faqs.component').then(m => m.FaqsComponent) },
  { path: '**', redirectTo: '/home' }
];
