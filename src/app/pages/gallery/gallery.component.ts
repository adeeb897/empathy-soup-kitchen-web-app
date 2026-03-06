import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, ScrollAnimateDirective],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit, OnDestroy {
  totalImages = 69;
  batchSize = 20;
  images: string[] = [];
  visibleImages: string[] = [];

  // Lightbox
  lightboxOpen = false;
  lightboxIndex = 0;
  lightboxLoading = true;

  // Infinite scroll
  private scrollObserver!: IntersectionObserver;

  // Touch/swipe
  private touchStartX = 0;
  private touchEndX = 0;

  ngOnInit(): void {
    // Build the full image list
    for (let i = 1; i <= this.totalImages; i++) {
      const num = i.toString().padStart(2, '0');
      this.images.push(`assets/gallery/Image-${num}.jpg`);
    }
    // Load first batch
    this.loadMore();

    // Set up infinite scroll observer
    setTimeout(() => this.setupScrollObserver(), 100);
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
  }

  private setupScrollObserver(): void {
    const sentinel = document.getElementById('gallery-sentinel');
    if (!sentinel) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    this.scrollObserver.observe(sentinel);
  }

  loadMore(): void {
    const currentCount = this.visibleImages.length;
    if (currentCount >= this.images.length) return;

    const nextBatch = this.images.slice(currentCount, currentCount + this.batchSize);
    this.visibleImages = [...this.visibleImages, ...nextBatch];
  }

  get hasMore(): boolean {
    return this.visibleImages.length < this.images.length;
  }

  // Lightbox
  openLightbox(index: number): void {
    this.lightboxIndex = index;
    this.lightboxOpen = true;
    this.lightboxLoading = true;
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxOpen = false;
    document.body.style.overflow = '';
  }

  lightboxPrev(): void {
    this.lightboxLoading = true;
    this.lightboxIndex = this.lightboxIndex > 0
      ? this.lightboxIndex - 1
      : this.images.length - 1;
  }

  lightboxNext(): void {
    this.lightboxLoading = true;
    this.lightboxIndex = this.lightboxIndex < this.images.length - 1
      ? this.lightboxIndex + 1
      : 0;
  }

  onLightboxImageLoad(): void {
    this.lightboxLoading = false;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (!this.lightboxOpen) return;

    switch (event.key) {
      case 'Escape':
        this.closeLightbox();
        break;
      case 'ArrowLeft':
        this.lightboxPrev();
        break;
      case 'ArrowRight':
        this.lightboxNext();
        break;
    }
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.lightboxNext();
      } else {
        this.lightboxPrev();
      }
    }
  }
}
