import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiConfig } from './api.config';

export interface Announcement {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string;
  category: string;
  locationLat: number;
  locationLng: number;
  locationAddr: string;
  status: 'ACTIVE' | 'HIDDEN' | 'UNAVAILABLE' | 'EXPIRED';
  fraudScore: number;
  createdAt: Date;
  expiresAt: Date;
  quantity: number;
  priceType: 'FREE' | 'UNIT' | 'BULK';
  priceValue: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAnnouncementsService {
  private readonly http = inject(HttpClient);

  private apiUrl(): string {
    return getApiConfig().BASE_URL;
  }

  // Get all announcements (including HIDDEN for admin panel)
  getAllAnnouncements(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(`${this.apiUrl()}/announcements?includeHidden=true`);
  }

  // Get single announcement
  getAnnouncement(id: string): Observable<Announcement> {
    return this.http.get<Announcement>(`${this.apiUrl()}/announcements/${id}`);
  }

  // Delete announcement
  deleteAnnouncement(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl()}/announcements/${id}`);
  }

  // Update announcement status
  updateAnnouncementStatus(id: string, status: 'ACTIVE' | 'HIDDEN' | 'EXPIRED' | 'UNAVAILABLE'): Observable<any> {
    return this.http.put<any>(`${this.apiUrl()}/announcements/${id}/status`, { status });
  }

  // Get announcements statistics
  getAnnouncementsStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl()}/announcements/statistics`);
  }
}
