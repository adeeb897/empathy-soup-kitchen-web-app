import { Component } from '@angular/core';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';

@Component({
    selector: 'app-get-involved',
    imports: [ScrollAnimateDirective],
    templateUrl: './get-involved.component.html',
    styleUrl: './get-involved.component.scss'
})
export class GetInvolvedComponent {
  activeTab = 'donate';

  tabs = [
    { id: 'donate', label: 'Donate', icon: 'favorite' },
    { id: 'refugee', label: 'Refugee Services', icon: 'public' },
  ];

  shoppingList = [
    'Trash Bags (35-55 gallon)',
    'Ziplock Bags',
    'Dish Soap',
    'Powder Drink Mix',
    'Canned Milk',
    'Sugar',
    'Canned Fruit & Apple Sauce',
    'Aluminum Foil',
    'Freezer Bags',
    'Packaged Cookies',
  ];

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }
}
