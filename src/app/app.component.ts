import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    <main id="main-content">
      <router-outlet />
    </main>
    <app-footer />
  `,
  styles: [`
    main {
      min-height: 100vh;
      padding-top: var(--nav-height);
    }
  `]
})
export class AppComponent {}
