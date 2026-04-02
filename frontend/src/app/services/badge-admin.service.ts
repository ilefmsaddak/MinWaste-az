import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiConfig } from './api.config';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  pointsRequired: number;
  usersEarned: number;
  createdAt: Date;
}

export interface CreateBadgeDto {
  name: string;
  description: string;
  icon: string;
  pointsRequired: number;
}

@Injectable({
  providedIn: 'root'
})
export class BadgeAdminService {
  private readonly http = inject(HttpClient);

  private badgesUrl(): string {
    return `${getApiConfig().BASE_URL}/badges`;
  }

  /**
   * Get all badges
   */
  getAllBadges(): Observable<Badge[]> {
    return this.http.get<Badge[]>(this.badgesUrl());
  }

  /**
   * Create a new badge
   */
  createBadge(badgeData: CreateBadgeDto): Observable<Badge> {
    return this.http.post<Badge>(this.badgesUrl(), badgeData);
  }

  /**
   * Update an existing badge
   */
  updateBadge(id: string, badgeData: Partial<CreateBadgeDto>): Observable<Badge> {
    return this.http.put<Badge>(`${this.badgesUrl()}/${id}`, badgeData);
  }

  /**
   * Delete a badge
   */
  deleteBadge(id: string): Observable<void> {
    return this.http.delete<void>(`${this.badgesUrl()}/${id}`);
  }

  /**
   * Get badge by ID
   */
  getBadgeById(id: string): Observable<Badge> {
    return this.http.get<Badge>(`${this.badgesUrl()}/${id}`);
  }
}
