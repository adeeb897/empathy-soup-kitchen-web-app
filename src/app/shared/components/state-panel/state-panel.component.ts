import { Component, EventEmitter, Input, Output } from '@angular/core';


/**
 * One presentation for the loading / empty / error states that admin sections
 * were each rendering differently — three loading treatments, three empty
 * states and three error models across shifts, signups and pledges.
 *
 *   <app-state-panel state="error" message="…" actionLabel="Try again"
 *                    (action)="reload()" />
 */
@Component({
    selector: 'app-state-panel',
    imports: [],
    template: `
    <div class="state" [class.state--error]="state === 'error'">
      @if (state === 'loading') {
        <div class="state__spinner"></div>
      } @else {
        <span class="material-icons state__icon">{{ icon }}</span>
      }

      <p class="state__message">{{ message }}</p>

      @if (actionLabel && state !== 'loading') {
        <button type="button" class="btn btn--ghost btn--small" (click)="action.emit()">
          <span class="material-icons">refresh</span>
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
    styles: [`
    .state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-3xl) var(--space-lg);
      background: var(--color-cream);
      border-radius: var(--border-radius-lg);
      color: var(--color-text-secondary);
      text-align: center;

      &--error {
        background: rgba(192, 86, 63, 0.07);
        border: 1px solid rgba(192, 86, 63, 0.2);
        color: #8E3F2D;
      }
    }

    .state__icon {
      font-size: 40px;
      opacity: 0.55;
    }

    .state__message {
      margin: 0;
      line-height: 1.6;
    }

    .state__spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-terracotta);
      border-radius: 50%;
      animation: state-spin 0.8s linear infinite;
    }

    @keyframes state-spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class StatePanelComponent {
  /** Which state to present. */
  @Input() state: 'loading' | 'empty' | 'error' = 'empty';
  @Input() message = '';
  /** Material icon for the empty state; errors always use error_outline. */
  @Input() emptyIcon = 'inbox';
  /** Shows a retry button when set. */
  @Input() actionLabel = '';

  /** Fired when the retry button is pressed. */
  @Output() action = new EventEmitter<void>();

  get icon(): string {
    return this.state === 'error' ? 'error_outline' : this.emptyIcon;
  }
}
