import { Component, Inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-image-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './image-dialog.component.html',
  styleUrl: './image-dialog.component.scss'
})
export class ImageDialogComponent {
  currentIndex: number = 0;
  isFirstImage: boolean = false;
  isLastImage: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<ImageDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.currentIndex = this.data.index;
    this.updateNavigationState();
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      this.nextImage();
    } else if (event.key === 'ArrowLeft') {
      this.previousImage();
    } else if (event.key === 'Escape') {
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  nextImage(): void {
    if (!this.isLastImage) {
      this.currentIndex++;
      this.data.image = this.data.images[this.currentIndex];
      this.updateNavigationState();
    }
  }

  previousImage(): void {
    if (!this.isFirstImage) {
      this.currentIndex--;
      this.data.image = this.data.images[this.currentIndex];
      this.updateNavigationState();
    }
  }

  private updateNavigationState(): void {
    this.isFirstImage = this.currentIndex === 0;
    this.isLastImage = this.currentIndex === this.data.images.length - 1;
  }
}
