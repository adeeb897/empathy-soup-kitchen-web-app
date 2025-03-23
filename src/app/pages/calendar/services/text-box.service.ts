import { Injectable } from '@angular/core';

interface TextBox {
  ID: number;
  TextName: string;
  TextContent: string;
}

@Injectable({
  providedIn: 'root'
})
export class TextBoxService {
  private apiEndpoint = '/data-api/rest/TextBoxes';

  constructor() { }

  /**
   * Get a text box by its name
   * @param textName The name of the text to fetch
   * @returns Promise with the text content or null if not found
   */
  async getTextByName(textName: string): Promise<string | null> {
    try {
      const endpoint = `${this.apiEndpoint}?$filter=TextName eq '${textName}'`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        return null;
      }

      try {
        const data = JSON.parse(text);
        if (data.value && data.value.length > 0) {
          return data.value[0].TextContent;
        }
        return null;
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching text box "${textName}":`, error);
      // Fall back to localStorage in case of API failure
      return localStorage.getItem(`textBox_${textName}`);
    }
  }

  /**
   * Update a text box's content
   * @param textName The name of the text to update
   * @param textContent The new content
   * @returns Promise<boolean> indicating success or failure
   */
  async updateText(textName: string, textContent: string): Promise<boolean> {
    try {
      // First check if the text exists
      const existingTextEndpoint = `${this.apiEndpoint}?$filter=TextName eq '${textName}'`;
      const checkResponse = await fetch(existingTextEndpoint);
      
      if (!checkResponse.ok) {
        throw new Error(`HTTP error! Status: ${checkResponse.status}`);
      }
      
      const checkText = await checkResponse.text();
      const checkData = JSON.parse(checkText);
      
      if (checkData.value && checkData.value.length > 0) {
        // Text exists, update it
        const textId = checkData.value[0].ID;
        const updateEndpoint = `${this.apiEndpoint}(${textId})`;
        const updateResponse = await fetch(updateEndpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ TextContent: textContent })
        });
        
        if (!updateResponse.ok) {
          throw new Error(`HTTP error! Status: ${updateResponse.status}`);
        }
      } else {
        // Text doesn't exist, create it
        const createResponse = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            TextName: textName,
            TextContent: textContent
          })
        });
        
        if (!createResponse.ok) {
          throw new Error(`HTTP error! Status: ${createResponse.status}`);
        }
      }
      
      // Also save to localStorage as a fallback
      localStorage.setItem(`textBox_${textName}`, textContent);
      return true;
    } catch (error) {
      console.error(`Error updating text box "${textName}":`, error);
      
      // Fall back to localStorage in case of API failure
      localStorage.setItem(`textBox_${textName}`, textContent);
      return false;
    }
  }

  /**
   * Get all available text boxes
   * @returns Promise with an array of TextBox objects
   */
  async getAllTextBoxes(): Promise<TextBox[]> {
    try {
      const response = await fetch(this.apiEndpoint);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const text = await response.text();
      if (!text) {
        return [];
      }
      
      try {
        const data = JSON.parse(text);
        return data.value || [];
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        return [];
      }
    } catch (error) {
      console.error('Error fetching all text boxes:', error);
      return [];
    }
  }
}
