import { Component } from '@angular/core';

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
})
export class CalendarComponent {
  // No additional code needed
  async list(): Promise<void> {
    const query = `
    {
      volunteerShifts {
        Items {
          id
          date
        }
      }
    }`;

    const endpoint = '/data-api/graphql';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query }),
    })
    .then(response => {
      return response.text()
    })
    .then((data) => {
      if (!data) {
        console.log('No data found');
        return {};
      }
      return JSON.parse(data);
    })
    .catch((error) => {
      console.error('Error:', error);
    })
    
    console.log(response);
  }

  async create() {

    const data = {
      id: "3",
      date: "2021-12-31"
    };
  
    const gql = `
      mutation create($item: CreateVolunteerShiftInput!) {
        createVolunteerShift(item: $item) {
          id
          date
        }
      }`;
    
    const query = {
      query: gql,
      variables: {
        item: data
      } 
    };
    
    const endpoint = "/data-api/graphql";
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query)
    });
    console.log(result);
  
    const response = await result.json();
    console.table(response.data.createVolunteerShift);
  }
}
