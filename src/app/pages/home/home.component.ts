import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ScrollAnimateDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  stats = [
    { value: 5000, suffix: '+', label: 'Meals Served' },
    { value: 3, suffix: '+', label: 'Years Running' },
  ];

  displayStats = [0, 0];
  private animationFrames: number[] = [];
  private statsObserver!: IntersectionObserver;

  @ViewChildren('statValue') statElements!: QueryList<ElementRef>;

  ngAfterViewInit(): void {
    const statsSection = document.querySelector('.stats');
    if (statsSection) {
      this.statsObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            this.animateCounters();
            this.statsObserver.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      this.statsObserver.observe(statsSection);
    }
  }

  ngOnDestroy(): void {
    this.animationFrames.forEach((id) => cancelAnimationFrame(id));
    this.statsObserver?.disconnect();
  }

  private animateCounters(): void {
    this.stats.forEach((stat, index) => {
      const duration = 2000;
      const start = performance.now();

      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        this.displayStats[index] = Math.round(eased * stat.value);

        if (progress < 1) {
          this.animationFrames[index] = requestAnimationFrame(animate);
        }
      };

      this.animationFrames[index] = requestAnimationFrame(animate);
    });
  }
}
