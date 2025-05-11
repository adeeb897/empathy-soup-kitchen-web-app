import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-refugee-services',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './refugee-services.component.html',
  styleUrl: './refugee-services.component.scss',
})
export class RefugeeServicesComponent {
  services = [
    {
      title: 'Food Assistance',
      description:
        'Providing nutritious meals and food packages to refugee families in need.',
      icon: 'restaurant',
    },
    {
      title: 'Employment',
      description:
        'Skills development and job placement assistance for refugees seeking employment.',
      icon: 'work',
    },
    {
      title: 'Financial Assistance',
      description:
        'Emergency financial support for refugees facing immediate hardships.',
      icon: 'monetization_on',
    },
  ];
}
