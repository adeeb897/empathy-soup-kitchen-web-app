import { Injectable } from '@angular/core';
import { RetryService } from '../../../shared/utils/retry.service';

interface TextBox {
  ID: number;
  TextName: string;
  TextContent: string;
}

@Injectable({
  providedIn: 'root',
})
export class TextBoxService {
  private apiEndpoint = '/data-api/rest/TextBoxes';
  private defaultTexts: { [key: string]: string } = {
    VolunteerInstructions:
      'Welcome to the volunteer signup portal! Please review available shifts and sign up for those that fit your schedule. If you have questions, contact us at volunteer@empathysoupkitchen.org.',
  };

  constructor(private retryService: RetryService) {}

  /**
   * Get a text box by its name
   * @param textName The name of the text to fetch
   * @returns Promise with the text content or null if not found
   */
  async getTextByName(textName: string): Promise<string | null> {
    // First try to get from localStorage (fastest)
    const cachedText = localStorage.getItem(`textBox_${textName}`);
    if (cachedText) {
      console.log(`Retrieved "${textName}" from local cache`);
      return this.decodeTextContent(cachedText);
    }

    try {
      console.log(`Fetching "${textName}" from API...`);
      const endpoint = `${this.apiEndpoint}?$filter=TextName eq ${textName}`;
      const response = await this.retryService.fetchWithRetry(endpoint);

      if (!response.ok) {
        console.warn(
          `API returned ${response.status} when fetching "${textName}"`
        );
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        return this.getDefaultText(textName);
      }

      // Validate that the response is actually JSON
      if (!this.isValidJSON(text)) {
        console.error('Invalid JSON response for text box:', text.substring(0, 200));
        return this.getDefaultText(textName);
      }

      try {
        const data = JSON.parse(text);
        if (data.value && data.value.length > 0) {
          const content = this.decodeTextContent(data.value[0].TextContent);
          // Cache for future use (store the raw content)
          localStorage.setItem(
            `textBox_${textName}`,
            data.value[0].TextContent
          );
          return content;
        }
        return this.getDefaultText(textName);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        return this.getDefaultText(textName);
      }
    } catch (error) {
      console.error(`Error fetching text box "${textName}":`, error);
      return this.getDefaultText(textName);
    }
  }

  /**
   * Get default text for a given text name
   */
  private getDefaultText(textName: string): string | null {
    // Check local storage as fallback
    const cachedText = localStorage.getItem(`textBox_${textName}`);
    if (cachedText) {
      return this.decodeTextContent(cachedText);
    }

    // Return default text if available
    if (this.defaultTexts[textName]) {
      console.log(`Using default text for "${textName}"`);
      return this.defaultTexts[textName];
    }

    return null;
  }

  /**
   * Update a text box's content
   * @param textName The name of the text to update
   * @param textContent The new content
   * @returns Promise<boolean> indicating success or failure
   */
  async updateText(textName: string, textContent: string): Promise<boolean> {
    // Encode the content to preserve whitespace and newlines
    const encodedContent = this.encodeTextContent(textContent);

    // Always update localStorage first for immediate feedback
    localStorage.setItem(`textBox_${textName}`, encodedContent);

    try {
      console.log(`Saving "${textName}" to API...`);
      // Check if database is available by making a simple GET request
      const testResponse = await this.retryService.fetchWithRetry(this.apiEndpoint, {
        method: 'HEAD',
        headers: { 'Content-Type': 'application/json' },
      }, { maxAttempts: 2 }).catch(() => null);

      // If we can't connect to the API, don't try further operations
      if (!testResponse || !testResponse.ok) {
        console.warn(
          'API appears to be unavailable, saving to localStorage only'
        );
        return false;
      }

      // First check if the text exists
      const existingTextEndpoint = `${this.apiEndpoint}?$filter=TextName eq ${textName}`;
      const checkResponse = await this.retryService.fetchWithRetry(existingTextEndpoint);

      if (!checkResponse.ok) {
        throw new Error(`HTTP error! Status: ${checkResponse.status}`);
      }

      const checkText = await checkResponse.text();
      let checkData;

      try {
        checkData = JSON.parse(checkText);
      } catch (e) {
        console.error(
          'Failed to parse response when checking for existing text',
          e
        );
        return false;
      }

      if (checkData.value && checkData.value.length > 0) {
        // Text exists, update it
        const textId = checkData.value[0].ID;
        const updateEndpoint = `${this.apiEndpoint}/${textId}`;
        const updateResponse = await this.retryService.fetchWithRetry(updateEndpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ TextContent: encodedContent }),
        });

        if (!updateResponse.ok) {
          throw new Error(`HTTP error! Status: ${updateResponse.status}`);
        }
      } else {
        // Text doesn't exist, create it
        const createResponse = await this.retryService.fetchWithRetry(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            TextName: textName,
            TextContent: encodedContent,
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`HTTP error! Status: ${createResponse.status}`);
        }
      }

      console.log(`Successfully saved "${textName}" to API`);
      return true;
    } catch (error) {
      console.error(`Error updating text box "${textName}" in API:`, error);
      console.log('Text was saved to localStorage as fallback');
      return false;
    }
  }

  /**
   * Encode text content to preserve whitespace and newlines
   */
  private encodeTextContent(content: string): string {
    // Option 1: Simple JSON.stringify to preserve all whitespace and newlines
    return JSON.stringify(content);

    // Alternative: If database has issues with quotes, use base64 encoding
    // return btoa(unescape(encodeURIComponent(content)));
  }

  /**
   * Decode text content that was previously encoded
   */
  private decodeTextContent(encodedContent: string): string {
    try {
      // Option 1: Parse JSON string
      // Remove any surrounding quotes and unescape any escaped characters
      return JSON.parse(encodedContent);

      // Alternative: If using base64 encoding
      // return decodeURIComponent(escape(atob(encodedContent)));
    } catch (e) {
      console.warn('Failed to decode text content, returning as-is', e);
      // If decoding fails, return the original text
      return encodedContent;
    }
  }

  /**
   * Get all available text boxes
   * @returns Promise with an array of TextBox objects
   */
  async getAllTextBoxes(): Promise<TextBox[]> {
    try {
      const response = await this.retryService.fetchWithRetry(this.apiEndpoint);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        return [];
      }

      // Validate that the response is actually JSON
      if (!this.isValidJSON(text)) {
        console.error('Invalid JSON response for all text boxes:', text.substring(0, 200));
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

      // If API fails, try to build a list from localStorage
      try {
        const textBoxes: TextBox[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('textBox_')) {
            const textName = key.replace('textBox_', '');
            const textContent = localStorage.getItem(key) || '';
            textBoxes.push({
              ID: i, // dummy ID
              TextName: textName,
              TextContent: textContent,
            });
          }
        }
        return textBoxes;
      } catch (e) {
        console.error('Failed to get texts from localStorage:', e);
        return [];
      }
    }
  }

  /**
   * Clear all cached text boxes from localStorage
   */
  clearCache(): void {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('textBox_')) {
        localStorage.removeItem(key);
      }
    }
  }

  private isValidJSON(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
}
