import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface DescriptionCorrectionRequest {
  description: string;
}

export interface DescriptionCorrectionResponse {
  corrected: string;
  original: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private requestTimeout = 30000; // 30 seconds timeout
  private aiEndpoint = '/ai/correct-description';

  constructor(
    private http: HttpClient,
    private apiService: ApiService
  ) {}

  /**
   * Correct and improve a description via backend API
   */
  correctDescription(description: string): Observable<DescriptionCorrectionResponse> {
    const baseUrl = this.apiService.getApiUrl();
    const url = `${baseUrl}${this.aiEndpoint}`;

    const request: DescriptionCorrectionRequest = {
      description: description
    };

    return this.http.post<DescriptionCorrectionResponse>(
      url,
      request
    ).pipe(
      timeout(this.requestTimeout),
      catchError((error: any) => this.handleError(error))
    );
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse | any) {
    let errorMessage = 'An error occurred while correcting the description.';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Network error: ${error.error.message}`;
    } else {
      // Server-side error or timeout
      if (error.name === 'TimeoutError') {
        errorMessage = 'Request timeout. The server took too long to respond.';
      } else if (error.status === 0) {
        errorMessage = 'Cannot connect to the server. Please check your connection.';
      } else if (error.status === 400) {
        errorMessage = error.error?.message || 'Invalid request. Please try again.';
      } else if (error.status === 401) {
        errorMessage = 'Unauthorized. Please log in again.';
      } else if (error.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage = `Server error (${error.status}): ${error.error?.message || error.message}`;
      }
    }

    console.error('AI Service error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
