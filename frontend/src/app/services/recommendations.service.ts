import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { FirebaseAuthService } from '../core/auth/firebase-auth.service';

/**
 * A single recommended item with scoring and metadata
 */
export interface RecommendationItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  photos: string[];
  address: string;
  priceType: string;
  priceAmount?: number;
  currency?: string;
  score: number;
  reason: string;
  reasonCode: 'CATEGORY_MATCH' | 'LOCATION_MATCH' | 'BROWSING_PATTERN' | 'TRENDING' | 'MULTIPLE_SIGNALS';
}

/**
 * The complete recommendations response
 */
export interface RecommendationsResponse {
  items: RecommendationItem[];
  hasMore: boolean;
  generatedAt: Date;
  message?: string;
}

const TRACK_ITEM_VIEW = gql`
  mutation TrackItemView($itemId: String!) {
    trackItemView(itemId: $itemId)
  }
`;

const GET_RECOMMENDED_ITEMS = gql`
  query GetRecommendedItems($limit: Int) {
    recommendedItems(limit: $limit) {
      items {
        id
        title
        description
        category
        photos
        address
        priceType
        priceAmount
        currency
        score
        reason
        reasonCode
      }
      hasMore
      generatedAt
      message
    }
  }
`;

const GET_BROWSING_HISTORY = gql`
  query GetBrowsingHistory($limit: Int) {
    browsingHistory(limit: $limit)
  }
`;

@Injectable({
  providedIn: 'root',
})
export class RecommendationsService {
  constructor(
    private apollo: Apollo,
    private auth: FirebaseAuthService,
  ) {}

  /**
   * Track an item view for the current user
   * Non-blocking operation
   */
  async trackView(itemId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: TRACK_ITEM_VIEW,
          variables: { itemId },
        })
      );
    } catch (err) {
      console.warn('Failed to track item view:', err);
      // Non-blocking - don't throw
    }
  }

  /**
   * Get personalized recommendations for the current user
   * Returns full recommendation items with scores, reasons, and images
   */
  async getRecommendations(limit: number = 10): Promise<RecommendationsResponse> {
    try {
      const result = await firstValueFrom(
        this.apollo.query<{ recommendedItems: RecommendationsResponse }>({
          query: GET_RECOMMENDED_ITEMS,
          variables: { limit },
          fetchPolicy: 'network-only',
        })
      );

      const response = result.data?.recommendedItems;
      if (!response) {
        return {
          items: [],
          hasMore: false,
          generatedAt: new Date(),
          message: 'No recommendations available',
        };
      }

      return response;
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      return {
        items: [],
        hasMore: false,
        generatedAt: new Date(),
        message: 'Failed to load recommendations',
      };
    }
  }

  /**
   * Get user's browsing history (items they've viewed)
   * Returns array of item IDs in reverse chronological order (most recent first)
   */
  async getBrowsingHistory(limit: number = 20): Promise<string[]> {
    try {
      const result = await firstValueFrom(
        this.apollo.query<{ browsingHistory: string[] }>({
          query: GET_BROWSING_HISTORY,
          variables: { limit },
          fetchPolicy: 'network-only',
        })
      );

      return result.data?.browsingHistory ?? [];
    } catch (err) {
      console.error('Failed to get browsing history:', err);
      return [];
    }
  }
}
