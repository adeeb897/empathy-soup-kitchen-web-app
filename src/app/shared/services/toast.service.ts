import { Injectable } from '@angular/core';

interface ToastOptions {
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private container: HTMLElement | null = null;

  private ensureContainer(): HTMLElement {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', 'check_circle', options);
  }

  error(message: string, options?: ToastOptions): void {
    this.show(message, 'error', 'error', options);
  }

  info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', 'info', options);
  }

  private show(message: string, type: string, icon: string, options?: ToastOptions): void {
    const container = this.ensureContainer();
    const duration = options?.duration ?? 4000;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="material-icons">${icon}</span><span>${message}</span>`;

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('is-visible');
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}
