import { Injectable } from '@angular/core';
import { API_CONFIG, getApiConfig } from './api.config';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiConfig = getApiConfig();
  private apiBaseUrl = this.apiConfig.BASE_URL;

  constructor() {
  }

  getApiUrl(): string {
    return this.apiBaseUrl;
  }

  setApiUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  getItemsEndpoint(): string {
    return `${this.apiBaseUrl}${API_CONFIG.ENDPOINTS.ITEMS}`;
  }

  getUsersEndpoint(): string {
    return `${this.apiBaseUrl}${API_CONFIG.ENDPOINTS.USERS}`;
  }

  getTransactionsEndpoint(): string {
    return `${this.apiBaseUrl}${API_CONFIG.ENDPOINTS.TRANSACTIONS}`;
  }

  getReviewsEndpoint(): string {
    return `${this.apiBaseUrl}${API_CONFIG.ENDPOINTS.REVIEWS}`;
  }

  getMessagesEndpoint(): string {
    return `${this.apiBaseUrl}${API_CONFIG.ENDPOINTS.MESSAGES}`;
  }
}
