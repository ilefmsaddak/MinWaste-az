import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AnnounceFormData } from '../models/models';
import { ApiService } from './api.service';
import { FirebaseAuthService } from '../core/auth/firebase-auth.service';

export interface ItemOwnerPreview {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  trustScore?: number;
  badges?: string[];
}

export interface OwnerReviewPreview {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewerName: string;
}

export interface ItemResponse {
  id: string;
  title: string;
  description: string;
  category: string;
  locationLat: number;
  locationLng: number;
  locationAddr: string;
  expiresAt?: string;
  quantity: number;
  quantityAvailable?: number;
  priceType: string;
  priceValue: number;
  status: string;
  ownerId: string;
  createdAt: string;
  photos?: string[];
  fraudScore?: number;
  owner?: ItemOwnerPreview;
  ownerReviews?: OwnerReviewPreview[];
}

export interface CreateItemDto {
  ownerId: string;
  title: string;
  description: string;
  category: string;
  locationLat: number;
  locationLng: number;
  locationAddr: string;
  expiresAt?: string;
  quantity: number;
  priceType: 'FREE' | 'UNIT' | 'BULK';
  priceValue: number;
  photos?: string[];
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  constructor(
    private http: HttpClient,
    private apiService: ApiService,
    private firebaseAuth: FirebaseAuthService,
  ) {}

  /**
   * PostgreSQL UUID (preferred, cached after profile load) or Firebase UID.
   */
  private ownerIdForApi(): string {
    const stored = localStorage.getItem('userId')?.trim();
    if (stored) return stored;
    const uid = this.firebaseAuth.getCurrentUser()?.uid;
    if (uid) return uid;
    throw new Error(
      'Log in to manage your announcements (or open the Profile page once).',
    );
  }

  createItem(formData: AnnounceFormData): Observable<ItemResponse> {
    // Map priceType from form format to backend format
    const priceTypeMap: { [key: string]: 'FREE' | 'UNIT' | 'BULK' } = {
      'free': 'FREE',
      'unit': 'UNIT',
      'wholesale': 'BULK'
    };

    // Determine price value based on price type
    let priceValue = formData.priceType === 'free' ? 0 : (formData.price || 0);

    let ownerId: string;
    try {
      ownerId = this.ownerIdForApi();
    } catch (e: any) {
      return throwError(() => e);
    }

    // Create FormData to send file and other data
    const httpFormData = new FormData();
    
    // Add all form fields
    httpFormData.append('ownerId', ownerId);
    httpFormData.append('title', formData.title);
    httpFormData.append('description', formData.description);
    httpFormData.append('category', formData.category);
    httpFormData.append('locationLat', String(formData.latitude || 0));
    httpFormData.append('locationLng', String(formData.longitude || 0));
    httpFormData.append('locationAddr', formData.location);
    if (formData.expiresAt) {
      httpFormData.append('expiresAt', formData.expiresAt);
    }
    httpFormData.append('quantity', String(formData.quantity));
    httpFormData.append('priceType', priceTypeMap[formData.priceType] || 'FREE');
    httpFormData.append('priceValue', String(priceValue));
    httpFormData.append('status', 'ACTIVE');

    // Add photo file if it exists
    if (formData.photo) {
      httpFormData.append('photo', formData.photo, formData.photo.name);
    }

    const endpoint = this.apiService.getItemsEndpoint();
    console.log('Sending POST request to:', endpoint);
    console.log('FormData ready with photo file');

    return this.http.post<ItemResponse>(
      endpoint,
      httpFormData
    );
  }

 
  getAllItems(): Observable<ItemResponse[]> {
    return this.http.get<ItemResponse[]>(
      this.apiService.getItemsEndpoint()
    );
  }

  /**
   * Get all announces created by the current user
   */
  getUserAnnounces(): Observable<ItemResponse[]> {
    let ownerId: string;
    try {
      ownerId = this.ownerIdForApi();
    } catch (e: any) {
      return throwError(() => e);
    }
    return this.http.get<ItemResponse[]>(
      `${this.apiService.getItemsEndpoint()}/owner/${encodeURIComponent(ownerId)}`,
    );
  }


  getItemById(id: string): Observable<ItemResponse> {
    return this.http.get<ItemResponse>(
      `${this.apiService.getItemsEndpoint()}/${id}`
    );
  }

  /**
   * Update an item
   */
  updateItem(id: string, updateData: Partial<CreateItemDto>): Observable<ItemResponse> {
    return this.http.patch<ItemResponse>(
      `${this.apiService.getItemsEndpoint()}/${id}`,
      updateData
    );
  }

  /**
   * Delete an item
   */
  deleteItem(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiService.getItemsEndpoint()}/${id}`
    );
  }
}
