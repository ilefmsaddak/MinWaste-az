import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  GET_ANNONCES,
  GET_ANNONCE_BY_ID,
  GET_ANNONCES_BY_CATEGORY,
  GET_ANNONCES_BY_STATUS,
  GET_ANNONCES_BY_OWNER_ID,
} from '../graphql/annonce.query';

export interface Location {
  lat: number;
  lng: number;
  addr: string;
}

export interface Owner {
  id: string;
  displayName: string;
  email?: string;
  points?: number;
  badges?: string[];
  trustScore?: number;
}

/** Données annonce unifiées (GraphQL `Item` + champs dérivés pour l’UI). */
export interface AnnonceData {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  category?: string;
  photos: string[];
  location?: Location;
  status: string;
  suggestedCategory?: string[];
  fraudScore?: number;
  createdAt: string;
  expiresAt?: string;
  quantity?: number;
  priceType: string;
  priceAmount?: number;
  owner?: Owner;
}

function normalizeItem(raw: Record<string, unknown> | null | undefined): AnnonceData | null {
  if (!raw) return null;
  const owner = raw['owner'] as Record<string, unknown> | undefined;
  const loc = raw['location'] as Record<string, unknown> | undefined;
  const priceVal = raw['priceValue'] ?? raw['priceAmount'];

  return {
    id: String(raw['id'] ?? ''),
    ownerId: String(owner?.['id'] ?? ''),
    title: String(raw['title'] ?? ''),
    description: raw['description'] != null ? String(raw['description']) : undefined,
    category: raw['category'] != null ? String(raw['category']) : undefined,
    photos: Array.isArray(raw['photos']) ? (raw['photos'] as string[]) : [],
    location:
      loc && loc['lat'] != null && loc['lng'] != null
        ? {
            lat: Number(loc['lat']),
            lng: Number(loc['lng']),
            addr: String(loc['addr'] ?? ''),
          }
        : undefined,
    status: String(raw['status'] ?? '').toLowerCase(),
    suggestedCategory: Array.isArray(raw['suggestedCategory'])
      ? (raw['suggestedCategory'] as string[])
      : undefined,
    fraudScore:
      raw['fraudScore'] != null ? Number(raw['fraudScore']) : undefined,
    createdAt:
      raw['createdAt'] instanceof Date
        ? (raw['createdAt'] as Date).toISOString()
        : String(raw['createdAt'] ?? ''),
    expiresAt:
      raw['expiresAt'] == null
        ? undefined
        : raw['expiresAt'] instanceof Date
          ? (raw['expiresAt'] as Date).toISOString()
          : String(raw['expiresAt']),
    quantity: raw['quantity'] != null ? Number(raw['quantity']) : undefined,
    priceType: String(raw['priceType'] ?? '').toLowerCase(),
    priceAmount: priceVal != null ? Number(priceVal) : undefined,
    owner: owner
      ? {
          id: String(owner['id'] ?? ''),
          displayName: String(owner['displayName'] ?? ''),
          email: owner['email'] != null ? String(owner['email']) : undefined,
          points: owner['points'] != null ? Number(owner['points']) : undefined,
          badges: Array.isArray(owner['badges'])
            ? (owner['badges'] as string[])
            : undefined,
          trustScore:
            owner['trustScore'] != null
              ? Number(owner['trustScore'])
              : undefined,
        }
      : undefined,
  };
}

function normalizeList(rows: unknown): AnnonceData[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => normalizeItem(r as Record<string, unknown>))
    .filter((x): x is AnnonceData => x != null);
}

@Injectable({ providedIn: 'root' })
export class AnnonceDataService {
  constructor(private apollo: Apollo) {}

  getAnnonces(): Observable<AnnonceData[]> {
    return this.apollo
      .watchQuery({
        query: GET_ANNONCES,
      })
      .valueChanges.pipe(
        map((result: any) => {
          const rows = result.data?.items ?? [];
          return normalizeList(rows);
        }),
      );
  }

  getAnnonceById(id: string): Observable<AnnonceData | null> {
    return this.apollo
      .watchQuery({
        query: GET_ANNONCE_BY_ID,
        variables: { id },
      })
      .valueChanges.pipe(
        map((result: any) => normalizeItem(result.data?.item)),
      );
  }

  getAnnoncesByCategory(category: string): Observable<AnnonceData[]> {
    return this.apollo
      .watchQuery({
        query: GET_ANNONCES_BY_CATEGORY,
        variables: { category },
      })
      .valueChanges.pipe(
        map((result: any) => normalizeList(result.data?.itemsByCategory)),
      );
  }

  /** Ex.: `PUBLISHED`, `DRAFT`, … (enum GraphQL `ItemStatus`) */
  getAnnoncesByStatus(status: string): Observable<AnnonceData[]> {
    return this.apollo
      .watchQuery({
        query: GET_ANNONCES_BY_STATUS,
        variables: { status },
      })
      .valueChanges.pipe(
        map((result: any) => normalizeList(result.data?.itemsByStatus)),
      );
  }

  getAnnoncesByOwnerId(ownerId: string): Observable<AnnonceData[]> {
    return this.apollo
      .watchQuery({
        query: GET_ANNONCES_BY_OWNER_ID,
        variables: { ownerId },
      })
      .valueChanges.pipe(
        map((result: any) => normalizeList(result.data?.itemsByOwnerId)),
      );
  }
}
