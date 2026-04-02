import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getApiConfig } from './api.config';
import { LoggerService } from './logger.service';

function unwrapUserRows(res: unknown): User[] {
  const raw = Array.isArray(res) ? res : (res as { data?: User[] })?.data ?? [];
  return raw.map((u) => ({
    ...u,
    joinDate:
      u.joinDate instanceof Date
        ? u.joinDate
        : new Date(u.joinDate as unknown as string),
  }));
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  joinDate: Date;
  status: 'active' | 'suspended';
  role: 'user' | 'admin';
  announcements?: number;
  points?: number;
  deletedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private users = signal<User[]>([]);
  users$ = computed(() => this.users());

  private apiBase(): string {
    return getApiConfig().BASE_URL;
  }

  loadUsers(): void {
    this.getAllUsers().subscribe({
      next: (data) => this.users.set(data),
      error: (err) => this.logger.logApiError('Error loading users', err),
    });
  }

  getAllUsers(): Observable<User[]> {
    return this.http
      .get<unknown>(`${this.apiBase()}/users`, {
        params: { pageSize: '200' },
      })
      .pipe(map(unwrapUserRows));
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiBase()}/users/${id}`);
  }

  suspendUser(id: string): Observable<unknown> {
    return this.http.put(`${this.apiBase()}/users/${id}/suspend`, {});
  }

  unsuspendUser(id: string): Observable<unknown> {
    return this.http.put(`${this.apiBase()}/users/${id}/unsuspend`, {});
  }

  deleteUser(id: string): Observable<unknown> {
    return this.http.delete(`${this.apiBase()}/users/${id}`);
  }

  getUserActivity(id: string): Observable<unknown[]> {
    return this.http.get<unknown[]>(`${this.apiBase()}/users/${id}/activity`);
  }

  searchUsers(query: string): Observable<User[]> {
    return this.http
      .get<unknown>(`${this.apiBase()}/users`, {
        params: { search: query, pageSize: '200' },
      })
      .pipe(map(unwrapUserRows));
  }

  getUsersStats(): Observable<{
    total: number;
    active: number;
    suspended: number;
    announcements: number;
  }> {
    return this.http.get<{
      total: number;
      active: number;
      suspended: number;
      announcements: number;
    }>(`${this.apiBase()}/users/statistics`);
  }
}
