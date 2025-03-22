import { Component } from '@angular/core';

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent {
  async list(): Promise<void> {
    try {
      const endpoint = '/data-api/rest/VolunteerShifts';
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text(); // Get response as text first

      if (!text) {
        console.log('Empty response received');
        return;
      }

      try {
        const data = JSON.parse(text);
        console.table(data.value);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.log('Raw response:', text);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async create() {
    try {
      const data = {
        Name: 'Pedro',
      };
      const endpoint = `/data-api/rest/SignUps/`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text(); // Get response as text first

      if (!text) {
        console.log('Empty response received');
        return;
      }

      try {
        const result = JSON.parse(text);
        console.table(result.value);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.log('Raw response:', text);
      }
    } catch (error) {
      console.error('Error creating data:', error);
    }
  }
}
