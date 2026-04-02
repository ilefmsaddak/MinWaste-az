import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  RecommendationsService,
  RecommendationItem,
  RecommendationsResponse,
} from '../../services/recommendations.service';
import { SlugService } from '../../services/slug.service';

@Component({
  selector: 'app-recommended-items',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recommended-items.html',
  styleUrl: './recommended-items.scss',
})
export class RecommendedItems implements OnInit {
  items = signal<RecommendationItem[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  message = signal<string | null>(null);
  private readonly brokenPhotoIds = signal(new Set<string>());

  constructor(
    private recommendationsService: RecommendationsService,
    private router: Router,
    private slugService: SlugService,
  ) {}

  async ngOnInit() {
    await this.loadRecommendations();
  }

  async loadRecommendations() {
    this.isLoading.set(true);
    this.error.set(null);
    this.message.set(null);

    try {
      const response: RecommendationsResponse =
        await this.recommendationsService.getRecommendations(6);

      if (!response.items || response.items.length === 0) {
        this.items.set([]);
        if (response.message) {
          this.message.set(response.message);
        }
        this.isLoading.set(false);
        return;
      }

      this.items.set(response.items);
      this.isLoading.set(false);
    } catch (err) {
      console.error('Error loading recommended items:', err);
      this.error.set('Failed to load recommendations');
      this.isLoading.set(false);
    }
  }

  getPhotoUrl(item: RecommendationItem): string {
    if (this.brokenPhotoIds().has(item.id)) {
      return '/logo.svg';
    }
    const url = item.photos && item.photos.length > 0 ? String(item.photos[0] ?? '').trim() : '';
    if (!url) {
      return '/logo.svg';
    }
    return url;
  }

  onPhotoError(itemId: string): void {
    this.brokenPhotoIds.update((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  }

  getScorePercentage(score: number): string {
    return (score * 100).toFixed(0);
  }

  getPriceLabel(item: RecommendationItem): string {
    if (item.priceType === 'FREE' || item.priceType === 'free') {
      return 'Free';
    }
    const amount = item.priceAmount ?? 0;
    const currency = item.currency ?? 'TND';
    return `${amount.toFixed(2)} ${currency}`;
  }

  openItem(item: RecommendationItem): void {
    const segment = this.slugService.generateSlug(item.title || 'item', item.id);
    this.router.navigate(['/annonce', segment]);
  }

  getReasonIcon(reasonCode: string): string {
    switch (reasonCode) {
      case 'CATEGORY_MATCH':
        return '🏷️';
      case 'LOCATION_MATCH':
        return '📍';
      case 'BROWSING_PATTERN':
        return '👀';
      case 'TRENDING':
        return '🔥';
      case 'MULTIPLE_SIGNALS':
        return '⭐';
      default:
        return '💡';
    }
  }
}
