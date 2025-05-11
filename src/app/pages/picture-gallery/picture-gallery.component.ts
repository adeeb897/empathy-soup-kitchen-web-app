import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ImageDialogComponent } from './image-dialog/image-dialog.component';

@Component({
  selector: 'app-picture-gallery',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatDialogModule,
    ImageDialogComponent,
  ],
  templateUrl: './picture-gallery.component.html',
  styleUrl: './picture-gallery.component.scss',
})
export class PictureGalleryComponent implements OnInit, AfterViewInit {
  images = [
    {
      src: '/assets/kitchen_1.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/kitchen_2.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/kitchen_3.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/kitchen_4.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/food_1.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-01.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-02.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-03.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-04.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-05.jpg',
      orientation: 'landscape'
    },
    {
      src: '/assets/gallery/Image-06.jpg',
      orientation: 'landscape'
    },
  ];

  constructor(public dialog: MatDialog) {}

  ngOnInit(): void {
    // Pre-load images to determine orientation
    this.images.forEach((image, index) => {
      const img = new Image();
      img.onload = () => {
        // Set orientation based on image dimensions
        image.orientation = img.width >= img.height ? 'landscape' : 'portrait';
      };
      img.src = image.src;
    });
  }

  ngAfterViewInit(): void {
    // Additional initialization after view is loaded if needed
  }

  openImageDialog(image: any, index: number): void {
    this.dialog.open(ImageDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      panelClass: 'image-dialog-panel',
      data: {
        image: image,
        images: this.images,
        index: index,
      },
    });
  }
}
