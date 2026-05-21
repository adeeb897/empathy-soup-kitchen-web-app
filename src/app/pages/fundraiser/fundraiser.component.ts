import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';

@Component({
  selector: 'app-fundraiser',
  standalone: true,
  imports: [CommonModule, ScrollAnimateDirective],
  templateUrl: './fundraiser.component.html',
  styleUrl: './fundraiser.component.scss',
})
export class FundraiserComponent {
  ticketsUrl = 'https://www.zeffy.com/en-US/ticketing/esk-fundraising';
}
