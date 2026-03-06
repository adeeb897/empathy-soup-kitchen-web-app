import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer" role="contentinfo">
      <div class="footer__inner container">
        <div class="footer__top">
          <div class="footer__brand">
            <div class="footer__logo">
              <img src="assets/logo.png" alt="" class="footer__logo-img">
              <span class="footer__logo-text">Empathy Soup Kitchen</span>
            </div>
            <p class="footer__tagline">Free meals every weekend.<br>No questions asked.</p>
          </div>

          <div class="footer__links-group">
            <h4 class="footer__heading">Navigate</h4>
            <a routerLink="/home">Home</a>
            <a routerLink="/volunteer">Volunteer</a>
            <a routerLink="/get-involved">Get Involved</a>
            <a routerLink="/gallery">Gallery</a>
            <a routerLink="/about">About</a>
          </div>

          <div class="footer__links-group">
            <h4 class="footer__heading">Visit Us</h4>
            <p>523 Sinclair Street<br>McKeesport, PA 15132</p>
            <p><strong>Sat &amp; Sun</strong><br>1:00 PM &ndash; 2:00 PM</p>
          </div>

          <div class="footer__links-group">
            <h4 class="footer__heading">Contact</h4>
            <a href="mailto:empathysoupkitchen&#64;gmail.com">empathysoupkitchen&#64;gmail.com</a>
          </div>
        </div>

        <div class="footer__bottom">
          <p>&copy; {{ currentYear }} Empathy Soup Kitchen. All rights reserved.</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      background: var(--color-charcoal);
      color: var(--color-cream);
      padding: var(--space-4xl) 0 var(--space-xl);
      margin-top: var(--space-5xl);
    }

    .footer__top {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2xl);
      padding-bottom: var(--space-2xl);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      @media (min-width: 768px) {
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: var(--space-3xl);
      }
    }

    .footer__brand {
      max-width: 280px;
    }

    .footer__logo {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .footer__logo-img {
      width: 36px;
      height: 36px;
      border-radius: var(--border-radius);
      object-fit: contain;
    }

    .footer__logo-text {
      font-size: var(--font-size-base);
      font-weight: 700;
      color: var(--color-white);
    }

    .footer__tagline {
      font-size: var(--font-size-sm);
      color: rgba(240, 235, 225, 0.7);
      line-height: 1.6;
    }

    .footer__heading {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: var(--color-terracotta-light);
      margin-bottom: var(--space-md);
    }

    .footer__links-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);

      a {
        color: rgba(240, 235, 225, 0.7);
        font-size: var(--font-size-sm);
        transition: color var(--transition-fast);

        &:hover {
          color: var(--color-white);
        }
      }

      p {
        font-size: var(--font-size-sm);
        color: rgba(240, 235, 225, 0.7);
        line-height: 1.6;
      }
    }

    .footer__bottom {
      padding-top: var(--space-xl);

      p {
        font-size: var(--font-size-xs);
        color: rgba(240, 235, 225, 0.4);
      }
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
