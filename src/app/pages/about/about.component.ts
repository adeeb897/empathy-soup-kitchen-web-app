import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollAnimateDirective } from '../../shared/components/scroll-animate.directive';
import { SafePipe } from '../../pipes/safe.pipe';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, ScrollAnimateDirective, SafePipe],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  mapsUrl = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3037.873990503389!2d-79.84668!3d40.347302!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8834dd3f7b7f051f%3A0x3ada31dc83666f6f!2s523%20Sinclair%20St%2C%20McKeesport%2C%20PA%2015132!5e0!3m2!1sen!2sus!4v1637329894007!5m2!1sen!2sus';

  boardMembers = [
    { name: 'Ahraz Zaman', image: 'assets/board_members/Ahraz_Zaman.png' },
    { name: 'Hamid Jafri', image: 'assets/board_members/Hamid_Jafri.png' },
    { name: 'Imran Qadeer', image: 'assets/board_members/Imran_Qadeer.png' },
    { name: 'Mudassar Ali', image: 'assets/board_members/Mudassar_Ali.png' },
    { name: 'Nusrah Hussain', image: 'assets/board_members/Nusrah_Hussain.jpeg' },
    { name: 'Omar Abbasi', image: 'assets/board_members/Omar_Abbasi.png' },
    { name: 'Saad Mehmood', image: 'assets/board_members/Saad_Mehmood.png' },
    { name: 'Shahryar Ghani', image: 'assets/board_members/Shahryar_Ghani.png' },
    { name: 'Syed Yasir Ahmed', image: 'assets/board_members/Syed_Yasir_Ahmed.jpeg' },
  ];

  faqs = [
    {
      question: 'When are you open?',
      answer: 'Every Saturday and Sunday, 1:00 PM to 2:00 PM. Just show up — no signup or reservation needed.',
    },
    {
      question: 'Who can eat here?',
      answer: 'Anyone and everyone. Babies to grandparents, no questions asked. All are welcome.',
    },
    {
      question: "What's on the menu?",
      answer: "The menu varies weekly based on donations and what our cooks prepare. We don't publish the menu ahead of time, but it's always a hot, home-cooked meal.",
    },
    {
      question: 'Do I need experience to volunteer?',
      answer: "No experience needed at all! We'll show you everything. Groups are welcome — families, work teams, student groups.",
    },
    {
      question: 'Can I just show up to volunteer?',
      answer: 'Volunteers must be scheduled in advance so we know how many to expect. Sign up through our volunteer page. Please arrive 10 minutes early.',
    },
    {
      question: 'What should I wear to volunteer?',
      answer: 'Comfortable clothes and closed-toe shoes are required. We provide aprons and gloves.',
    },
    {
      question: 'What will I do as a volunteer?',
      answer: "The meal is prepared before volunteers arrive. You'll help set up the dining room, welcome guests, bring meals to tables, and clean up afterward.",
    },
  ];

  openFaqIndex: number | null = null;

  toggleFaq(index: number): void {
    this.openFaqIndex = this.openFaqIndex === index ? null : index;
  }
}
