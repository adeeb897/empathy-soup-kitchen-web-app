import {
  Injectable,
  InjectionToken,
  ApplicationRef,
  createComponent,
  EnvironmentInjector,
  Type,
  Injector,
} from '@angular/core';

export const MODAL_DATA = new InjectionToken<any>('MODAL_DATA');
export const MODAL_REF = new InjectionToken<ModalRef>('MODAL_REF');

export class ModalRef {
  private resolvePromise!: (value: any) => void;
  readonly result: Promise<any>;
  private overlay: HTMLElement | null = null;

  constructor() {
    this.result = new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  close(result?: any): void {
    if (this.overlay) {
      this.overlay.classList.remove('is-visible');
      setTimeout(() => {
        this.overlay?.remove();
        this.resolvePromise(result);
      }, 250);
    } else {
      this.resolvePromise(result);
    }
  }

  setOverlay(overlay: HTMLElement): void {
    this.overlay = overlay;
  }
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  open<T>(component: Type<T>, data?: any): ModalRef {
    const modalRef = new ModalRef();

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    modalRef.setOverlay(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        modalRef.close(null);
      }
    });

    // Close on Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        modalRef.close(null);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Create child injector with MODAL_DATA and MODAL_REF
    const childInjector = Injector.create({
      providers: [
        { provide: MODAL_DATA, useValue: data },
        { provide: MODAL_REF, useValue: modalRef },
      ],
      parent: this.injector,
    });

    // Create the component
    const componentRef = createComponent(component, {
      environmentInjector: this.injector,
      elementInjector: childInjector,
    });

    this.appRef.attachView(componentRef.hostView);

    // Append component to overlay
    overlay.appendChild(componentRef.location.nativeElement);
    document.body.appendChild(overlay);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
    });

    // Cleanup on close
    modalRef.result.then(() => {
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    });

    return modalRef;
  }
}
