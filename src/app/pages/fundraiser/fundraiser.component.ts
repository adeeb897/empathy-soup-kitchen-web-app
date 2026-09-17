import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';

@Component({
    selector: 'app-fundraiser',
    imports: [ScrollAnimateDirective],
    templateUrl: './fundraiser.component.html',
    styleUrl: './fundraiser.component.scss'
})
export class FundraiserComponent {
  ticketsUrl = 'https://www.zeffy.com/en-US/ticketing/esk-fundraising';
}
