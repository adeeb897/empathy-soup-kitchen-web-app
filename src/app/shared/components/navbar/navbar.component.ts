import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="navbar" [class.navbar--scrolled]="isScrolled" role="navigation" aria-label="Main navigation">
      <div class="navbar__inner">
        <a routerLink="/home" class="navbar__logo" aria-label="Empathy Soup Kitchen - Home">
          <img src="assets/logo.png" alt="" class="navbar__logo-img">
          <span class="navbar__logo-text">Empathy<br>Soup Kitchen</span>
        </a>

        <ul class="navbar__links" [class.navbar__links--open]="mobileOpen" role="menubar">
          <li role="none"><a routerLink="/home" routerLinkActive="is-active" [routerLinkActiveOptions]="{exact: true}" role="menuitem" (click)="closeMobile()">Home</a></li>
          <li role="none"><a routerLink="/volunteer" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Volunteer</a></li>
          <li role="none"><a routerLink="/get-involved" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Get Involved</a></li>
          <li role="none"><a routerLink="/gallery" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Gallery</a></li>
          <li role="none"><a routerLink="/about" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">About</a></li>
        </ul>

        <a routerLink="/get-involved" class="navbar__cta btn btn--primary btn--small" (click)="closeMobile()">
          Donate
        </a>

        <button
          class="navbar__toggle"
          (click)="toggleMobile()"
          [attr.aria-expanded]="mobileOpen"
          aria-controls="mobile-menu"
          aria-label="Toggle navigation menu">
          <span class="navbar__toggle-line" [class.is-open]="mobileOpen"></span>
          <span class="navbar__toggle-line" [class.is-open]="mobileOpen"></span>
          <span class="navbar__toggle-line" [class.is-open]="mobileOpen"></span>
        </button>
      </div>

      @if (mobileOpen) {
        <div class="navbar__mobile" id="mobile-menu" role="menu">
          <a routerLink="/home" routerLinkActive="is-active" [routerLinkActiveOptions]="{exact: true}" role="menuitem" (click)="closeMobile()">Home</a>
          <a routerLink="/volunteer" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Volunteer</a>
          <a routerLink="/get-involved" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Get Involved</a>
          <a routerLink="/gallery" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">Gallery</a>
          <a routerLink="/about" routerLinkActive="is-active" role="menuitem" (click)="closeMobile()">About</a>
          <div class="navbar__mobile-cta">
            <a routerLink="/get-involved" class="btn btn--primary btn--large" style="width:100%" (click)="closeMobile()">Donate Now</a>
          </div>
        </div>
      }
    </nav>
  `,
  styles: [`
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: rgba(251, 246, 239, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: all var(--transition-base);
      border-bottom: 1px solid transparent;

      &--scrolled {
        background: rgba(251, 246, 239, 0.95);
        border-bottom-color: var(--color-border);
        box-shadow: var(--shadow-sm);
      }
    }

    .navbar__inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 var(--space-lg);
      height: var(--nav-height);
    }

    .navbar__logo {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      color: var(--color-charcoal);
      text-decoration: none;
      flex-shrink: 0;

      &:hover { color: var(--color-charcoal); }
    }

    .navbar__logo-img {
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius);
      object-fit: contain;
    }

    .navbar__logo-text {
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.3;
      letter-spacing: 0.01em;
    }

    .navbar__links {
      display: none;
      align-items: center;
      gap: var(--space-xs);

      @media (min-width: 900px) {
        display: flex;
      }

      a {
        padding: 0.5rem 1rem;
        font-size: var(--font-size-sm);
        font-weight: 500;
        color: var(--color-text);
        border-radius: var(--border-radius);
        transition: all var(--transition-fast);

        &:hover {
          color: var(--color-charcoal);
          background: rgba(59, 47, 42, 0.04);
        }

        &.is-active {
          color: var(--color-terracotta);
          background: rgba(191, 107, 63, 0.08);
        }
      }
    }

    .navbar__cta {
      display: none;

      @media (min-width: 900px) {
        display: inline-flex;
      }
    }

    .navbar__toggle {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 8px;
      background: none;
      border: none;
      cursor: pointer;

      @media (min-width: 900px) {
        display: none;
      }
    }

    .navbar__toggle-line {
      display: block;
      width: 22px;
      height: 2px;
      background: var(--color-charcoal);
      border-radius: 1px;
      transition: all var(--transition-base);
      transform-origin: center;

      &.is-open:nth-child(1) {
        transform: translateY(7px) rotate(45deg);
      }

      &.is-open:nth-child(2) {
        opacity: 0;
      }

      &.is-open:nth-child(3) {
        transform: translateY(-7px) rotate(-45deg);
      }
    }

    .navbar__mobile {
      display: flex;
      flex-direction: column;
      padding: var(--space-md) var(--space-lg) var(--space-xl);
      background: var(--color-warm-white);
      border-top: 1px solid var(--color-border);
      animation: slideDown 0.25s ease;

      @media (min-width: 900px) {
        display: none;
      }

      a {
        padding: var(--space-md) var(--space-md);
        font-size: var(--font-size-lg);
        font-weight: 500;
        color: var(--color-text);
        border-radius: var(--border-radius);
        transition: background var(--transition-fast);

        &:hover {
          background: rgba(59, 47, 42, 0.04);
        }

        &.is-active {
          color: var(--color-terracotta);
        }
      }
    }

    .navbar__mobile-cta {
      padding-top: var(--space-lg);
      margin-top: var(--space-md);
      border-top: 1px solid var(--color-border);
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class NavbarComponent {
  isScrolled = false;
  mobileOpen = false;

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled = window.scrollY > 20;
  }

  toggleMobile(): void {
    this.mobileOpen = !this.mobileOpen;
  }

  closeMobile(): void {
    this.mobileOpen = false;
  }
}
