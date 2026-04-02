import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiConfig } from './api.config';

export interface LeaderboardEntry {
  rank: number;
  userName: string;
  points: number;
  badges: number;
  level: string;
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  private readonly http = inject(HttpClient);

  private apiUrl(): string {
    return `${getApiConfig().BASE_URL}/leaderboard`;
  }

  /**
   * Fetch the complete leaderboard from the backend
   */
  getLeaderboard(limit?: number): Observable<LeaderboardEntry[]> {
    let url = this.apiUrl();
    if (limit) {
      url += `?limit=${limit}`;
    }
    return this.http.get<LeaderboardEntry[]>(url);
  }

  /**
   * Get leaderboard with pagination
   */
  getLeaderboardWithPagination(page: number = 1, pageSize: number = 10): Observable<{ data: LeaderboardEntry[], total: number }> {
    return this.http.get<{ data: LeaderboardEntry[], total: number }>(
      `${this.apiUrl()}?page=${page}&pageSize=${pageSize}`
    );
  }

  /**
   * Get top N users from the leaderboard
   */
  getTopUsers(limit: number = 10): Observable<LeaderboardEntry[]> {
    return this.getLeaderboard(limit);
  }

  /**
   * Get leaderboard statistics (total points, average points, etc.)
   */
  getLeaderboardStats(): Observable<{ totalPoints: number, averagePoints: number, totalUsers: number }> {
    return this.http.get<{ totalPoints: number, averagePoints: number, totalUsers: number }>(
      `${this.apiUrl()}/stats`
    );
  }

  /**
   * Get a specific user's leaderboard rank and position
   */
  getUserRank(userId: string): Observable<LeaderboardEntry> {
    return this.http.get<LeaderboardEntry>(`${this.apiUrl()}/user/${userId}`);
  }
}
