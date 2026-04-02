import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  /**
   * Log debug messages - DISABLED
   */
  debug(message: string, data?: unknown): void {
    // Disabled - no console output
  }

  /**
   * Log info messages - DISABLED
   */
  info(message: string, data?: unknown): void {
    // Disabled - no console output
  }

  /**
   * Log warnings - DISABLED
   */
  warn(message: string, data?: unknown): void {
    // Disabled - no console output
  }

  /**
   * Log errors - DISABLED
   * No error logging to keep console clean
   */
  error(message: string, error?: unknown): void {
    // Disabled - no console output
  }

  /**
   * Safely log API responses - DISABLED
   */
  logApiResponse(message: string, data: unknown): void {
    // Disabled - no console output
  }

  /**
   * Safely log API errors - DISABLED
   */
  logApiError(message: string, error: unknown): void {
    // Disabled - no console output
  }
}

