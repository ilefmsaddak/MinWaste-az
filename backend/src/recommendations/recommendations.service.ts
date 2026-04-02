import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureStorageService } from '../storage/azure-storage.service';
import {
  RecommendationItemDto,
  RecommendationsResponseDto,
  CategoryPreference,
  LocationPreference,
  RecommendationScore,
} from './dto/recommendation.dto';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly azureStorage: AzureStorageService,
  ) {}

  private toPhotoUrl(rawUrl: string): string {
    const url = String(rawUrl ?? '').trim();
    if (!url) return '/logo.svg';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return this.azureStorage.getPhotoUrl(url);
  }

  /**
   * Track an item view for a user
   * Increments view_count if already viewed, creates new entry otherwise
   */
  async trackItemView(userId: string, itemId: string): Promise<void> {
    try {
      // Use upsert to either create or increment view count
      await this.prisma.item_views.upsert({
        where: { user_id_item_id: { user_id: userId, item_id: itemId } },
        update: {
          view_count: { increment: 1 },
          last_viewed_at: new Date(),
        },
        create: {
          user_id: userId,
          item_id: itemId,
          view_count: 1,
        },
      });

      this.logger.debug(`Tracked view: user=${userId}, item=${itemId}`);
    } catch (err) {
      this.logger.error(`Failed to track item view: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Get personalized recommendations for a user
   * Uses 3 signals: browsing history, category preferences, location preferences
   */
  async getRecommendedItems(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationsResponseDto> {
    try {
      const startTime = Date.now();

      // Get user's category preferences
      const categoryPrefs = await this.getUserCategoryPreferences(userId);

      // Get user's location preference from completed transactions
      const locationPref = await this.getUserPreferredLocation(userId);

      // Get user's recent viewed items (last 14 days) for similarity
      const recentViews = await this.getRecentViewedItems(userId, 14);

      // Get all viewed item IDs to exclude from recommendations
      const viewedItemIds = await this.getAllViewedItemIds(userId);

      // Get user's own items to exclude
      const userOwnedItems = await this.getUserOwnedItemIds(userId);

      // Get items with active transactions to exclude
      const userTransactionItems = await this.getUserTransactionItemIds(userId);

      const excludeIds = new Set([
        ...viewedItemIds,
        ...userOwnedItems,
        ...userTransactionItems,
      ]);

      // Fetch candidate items (PUBLISHED, not expired, available)
      const candidateItems = await this.prisma.items.findMany({
        where: {
          status: 'PUBLISHED',
          owner_id: { not: userId },
          id: { notIn: Array.from(excludeIds) },
          // Not expired
          OR: [
            { expires_at: null },
            { expires_at: { gt: new Date() } },
          ],
          // Available quantity > 0
          quantity_available: { gt: 0 },
        },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          item_photos: {
            select: { url: true },
            orderBy: { position: 'asc' },
            take: 1,
          },
          address: true,
          lat: true,
          lng: true,
          price_type: true,
          price_amount: true,
          currency: true,
          created_at: true,
        },
        take: 200, // Get more candidates for better scoring
      });

      // Score each candidate item
      const scoredItems: RecommendationScore[] = candidateItems
        .map((item) => {
          // Calculate category affinity (0-1)
          const categoryAffinity = this.calculateCategoryAffinity(
            item.category,
            categoryPrefs,
          );

          // Calculate location affinity (0-1)
          const locationAffinity = this.calculateLocationAffinity(
            item.lat,
            item.lng,
            item.address,
            locationPref,
          );

          // Calculate browsing similarity (0-1)
          const browsingSimility = this.calculateBrowsingSimplicity(
            item.category,
            item.title,
            recentViews,
          );

          // Calculate freshness score (0-1)
          const freshnessScore = this.calculateFreshnessScore(
            item.created_at,
          );

          // WEIGHTED SCORING FORMULA
          // category_affinity (45%) + location_affinity (30%) + browsing_similarity (15%) + freshness (10%)
          const totalScore =
            categoryAffinity * 0.45 +
            locationAffinity * 0.3 +
            browsingSimility * 0.15 +
            freshnessScore * 0.1;

          // Determine reason code (what drove the recommendation)
          const reasonCode = this.determineReasonCode(
            categoryAffinity,
            locationAffinity,
            browsingSimility,
            freshnessScore,
          );

          return {
            itemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            photos: item.item_photos.map((p) => this.toPhotoUrl(p.url)),
            address: item.address,
            priceType: item.price_type,
            priceAmount: item.price_amount ? Number(item.price_amount) : undefined,
            currency: item.currency,
            categoryAffinity,
            locationAffinity,
            browsingSimility,
            freshnessScore,
            totalScore,
            reasonCode,
          };
        })
        .filter((score) => score.totalScore > 0) // Only include items with some relevance
        .sort((a, b) => b.totalScore - a.totalScore) // Sort by score descending
        .slice(0, limit); // Take top N

      // Build response DTOs
      const items: RecommendationItemDto[] = scoredItems.map((score) => ({
        id: score.itemId,
        title: score.title,
        description: score.description,
        category: score.category,
        photos: score.photos.length > 0 ? score.photos : ['/logo.svg'],
        address: score.address,
        priceType: score.priceType,
        priceAmount: score.priceAmount,
        currency: score.currency,
        score: score.totalScore,
        reason: this.generateReason(score.reasonCode, score),
        reasonCode: score.reasonCode,
      }));

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Generated recommendations for user=${userId}: count=${items.length}, duration=${duration}ms`,
      );

      return {
        items,
        hasMore: items.length === limit,
        generatedAt: new Date(),
        message:
          items.length === 0
            ? 'No recommendations available yet. Browse items to get personalized suggestions!'
            : undefined,
      };
    } catch (err) {
      this.logger.error(`Failed to get recommendations: ${err.message}`, err);
      return {
        items: [],
        hasMore: false,
        generatedAt: new Date(),
        message: 'Failed to load recommendations. Please try again.',
      };
    }
  }

  /**
   * Calculate category affinity (how much user interacts with this category)
   * Score = (views×1 + favorites×3 + completed_transactions×5) / max_category_score
   */
  private calculateCategoryAffinity(
    itemCategory: string | null,
    categoryPrefs: CategoryPreference[],
  ): number {
    if (!itemCategory) return 0.3; // Neutral for uncategorized items

    const pref = categoryPrefs.find((p) => p.category === itemCategory);
    if (!pref) return 0; // Not in user's preferences

    // Return normalized score (0-1)
    // Assuming max score is around 10-20 for active users
    return Math.min(1, pref.score / 20);
  }

  /**
   * Calculate location affinity based on preferred location from transactions
   * Perfect match = 1.0, same city = 0.7, different = 0.3
   */
  private calculateLocationAffinity(
    itemLat: any,
    itemLng: any,
    itemAddress: string | null,
    locationPref: LocationPreference,
  ): number {
    // If user has no transaction history, neutral
    if (!locationPref.neighborhood && !locationPref.city) {
      return 0.5;
    }

    // If items have coordinates, calculate distance
    if (itemLat != null && itemLng != null && locationPref.lat && locationPref.lng) {
      const itemLatNum = Number(itemLat);
      const itemLngNum = Number(itemLng);

      const distance = Math.sqrt(
        Math.pow(itemLatNum - locationPref.lat, 2) +
          Math.pow(itemLngNum - locationPref.lng, 2),
      );

      // Simple decay: within 0.1 degrees = 1.0, 0.5 degrees = 0.5, >1 degree = 0.2
      if (distance < 0.1) return 1.0;
      if (distance < 0.5) return 0.7;
      if (distance < 1.0) return 0.4;
      return 0.2;
    }

    // Try matching by neighborhood or city name in address
    if (itemAddress && locationPref.neighborhood) {
      if (itemAddress.toLowerCase().includes(locationPref.neighborhood.toLowerCase())) {
        return 1.0;
      }
    }

    if (itemAddress && locationPref.city) {
      if (itemAddress.toLowerCase().includes(locationPref.city.toLowerCase())) {
        return 0.7;
      }
    }

    return 0.3; // Default for unknown location
  }

  /**
   * Calculate browsing similarity
   * How similar is the item to recently viewed items
   */
  private calculateBrowsingSimplicity(
    itemCategory: string | null,
    itemTitle: string,
    recentViews: Array<{ category: string | null; title: string }>,
  ): number {
    if (recentViews.length === 0) return 0;

    let matches = 0;

    for (const viewed of recentViews) {
      // Category match
      if (itemCategory && viewed.category === itemCategory) {
        matches += 0.5;
      }

      // Title keyword match (simple substring matching)
      const itemWords = itemTitle.toLowerCase().split(/\s+/);
      const viewedWords = viewed.title.toLowerCase().split(/\s+/);

      const commonWords = itemWords.filter((word) =>
        viewedWords.some(
          (vWord) =>
            word === vWord ||
            (word.length > 3 && vWord.includes(word)) ||
            (vWord.length > 3 && word.includes(vWord)),
        ),
      );

      if (commonWords.length > 0) {
        matches += 0.25;
      }
    }

    // Normalize by recent views count
    return Math.min(1, matches / recentViews.length);
  }

  /**
   * Calculate freshness score
   * Recent items get higher scores
   */
  private calculateFreshnessScore(createdAt: Date): number {
    const ageDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays <= 7) return 1.0; // Brand new
    if (ageDays <= 30) return 0.8; // Recent
    if (ageDays <= 90) return 0.5; // Older
    return 0.2; // Old
  }

  /**
   * Determine the primary reason code for the recommendation
   */
  private determineReasonCode(
    categoryAffinity: number,
    locationAffinity: number,
    browsingSimility: number,
    freshnessScore: number,
  ): 'CATEGORY_MATCH' | 'LOCATION_MATCH' | 'BROWSING_PATTERN' | 'TRENDING' | 'MULTIPLE_SIGNALS' {
    const scores = [
      { score: categoryAffinity, code: 'CATEGORY_MATCH' as const },
      { score: locationAffinity, code: 'LOCATION_MATCH' as const },
      { score: browsingSimility, code: 'BROWSING_PATTERN' as const },
      { score: freshnessScore, code: 'TRENDING' as const },
    ];

    const sorted = scores.sort((a, b) => b.score - a.score);

    // If top 2 scores are close, it's multiple signals
    if (
      sorted[0].score > 0 &&
      sorted[1].score > 0 &&
      Math.abs(sorted[0].score - sorted[1].score) < 0.2
    ) {
      return 'MULTIPLE_SIGNALS';
    }

    return sorted[0].code;
  }

  /**
   * Generate a human-readable reason for the recommendation
   */
  private generateReason(
    reasonCode: string,
    score: Partial<RecommendationScore>,
  ): string {
    switch (reasonCode) {
      case 'CATEGORY_MATCH':
        return `Matches your interest in ${score.category || 'this category'}`;
      case 'LOCATION_MATCH':
        return `Available in your preferred area`;
      case 'BROWSING_PATTERN':
        return `Similar to items you've been viewing`;
      case 'TRENDING':
        return `Recently added to MinWaste`;
      case 'MULTIPLE_SIGNALS':
        return `Recommended based on your activity`;
      default:
        return `Personalized for you`;
    }
  }

  /**
   * Get user's preferred categories based on views, favorites, and transactions
   */
  private async getUserCategoryPreferences(
    userId: string,
  ): Promise<CategoryPreference[]> {
    const categoryScores = new Map<string, CategoryPreference>();

    // Get viewed items and their categories
    const viewedItems = await this.prisma.item_views.findMany({
      where: { user_id: userId },
      include: { items: { select: { category: true } } },
      take: 100,
    });

    for (const view of viewedItems) {
      if (!view.items.category) continue;

      const cat = view.items.category;
      const existing = categoryScores.get(cat) || {
        category: cat,
        score: 0,
        sources: { viewCount: 0, favoriteCount: 0, transactionCount: 0 },
      };

      existing.sources.viewCount += view.view_count || 1;
      existing.score += (view.view_count || 1) * 1; // views count 1x
      categoryScores.set(cat, existing);
    }

    // Get favorite items and their categories
    const favorites = await this.prisma.favorites.findMany({
      where: { user_id: userId },
      include: { items: { select: { category: true } } },
    });

    for (const fav of favorites) {
      if (!fav.items.category) continue;

      const cat = fav.items.category;
      const existing = categoryScores.get(cat) || {
        category: cat,
        score: 0,
        sources: { viewCount: 0, favoriteCount: 0, transactionCount: 0 },
      };

      existing.sources.favoriteCount += 1;
      existing.score += 3; // favorites count 3x
      categoryScores.set(cat, existing);
    }

    // Get completed transaction items and their categories
    const transactions = await this.prisma.transactions.findMany({
      where: {
        receiver_id: userId,
        status: 'COMPLETED',
      },
      include: { items: { select: { category: true } } },
    });

    for (const tx of transactions) {
      if (!tx.items.category) continue;

      const cat = tx.items.category;
      const existing = categoryScores.get(cat) || {
        category: cat,
        score: 0,
        sources: { viewCount: 0, favoriteCount: 0, transactionCount: 0 },
      };

      existing.sources.transactionCount += 1;
      existing.score += 5; // transactions count 5x
      categoryScores.set(cat, existing);
    }

    // Return sorted by score descending
    return Array.from(categoryScores.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Get user's preferred location from completed transactions
   */
  private async getUserPreferredLocation(userId: string): Promise<LocationPreference> {
    // Get all completed transactions for this user (as receiver)
    const impacts = await this.prisma.transaction_impacts.findMany({
      where: {
        receiver_id: userId,
      },
      select: {
        neighborhood: true,
        items: { select: { lat: true, lng: true, address: true } },
      },
    });

    if (impacts.length === 0) {
      return { neighborhood: undefined, city: undefined, frequency: 0 };
    }

    // Count frequency of neighborhoods
    const neighborhoodCounts = new Map<string, number>();

    for (const impact of impacts) {
      if (impact.neighborhood) {
        const count = neighborhoodCounts.get(impact.neighborhood) || 0;
        neighborhoodCounts.set(impact.neighborhood, count + 1);
      }
    }

    // Get most frequent neighborhood
    const [mostFrequentNeighborhood, frequency] = Array.from(
      neighborhoodCounts.entries(),
    ).reduce(
      (prev, current) =>
        current[1] > prev[1] ? current : prev,
      ['', 0],
    );

    // Try to extract city from address or use transaction location
    let lat: number | undefined;
    let lng: number | undefined;

    const firstImpact = impacts[0];
    if (firstImpact.items?.lat && firstImpact.items?.lng) {
      lat = Number(firstImpact.items.lat);
      lng = Number(firstImpact.items.lng);
    }

    return {
      neighborhood: mostFrequentNeighborhood,
      city: undefined, // Can be enhanced to extract from address
      frequency,
      lat,
      lng,
    };
  }

  /**
   * Get recently viewed items (within X days)
   */
  private async getRecentViewedItems(
    userId: string,
    daysCutoff: number = 14,
  ): Promise<Array<{ category: string | null; title: string }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysCutoff);

    const views = await this.prisma.item_views.findMany({
      where: {
        user_id: userId,
        last_viewed_at: { gte: cutoffDate },
      },
      include: { items: { select: { category: true, title: true } } },
      orderBy: { last_viewed_at: 'desc' },
      take: 30,
    });

    return views.map((v) => ({
      category: v.items.category,
      title: v.items.title,
    }));
  }

  /**
   * Get all item IDs viewed by user
   */
  private async getAllViewedItemIds(userId: string): Promise<string[]> {
    const views = await this.prisma.item_views.findMany({
      where: { user_id: userId },
      select: { item_id: true },
    });

    return views.map((v) => v.item_id);
  }

  /**
   * Get all item IDs owned by user
   */
  private async getUserOwnedItemIds(userId: string): Promise<string[]> {
    const items = await this.prisma.items.findMany({
      where: { owner_id: userId },
      select: { id: true },
    });

    return items.map((i) => i.id);
  }

  /**
   * Get item IDs where user has active transactions
   */
  private async getUserTransactionItemIds(userId: string): Promise<string[]> {
    const txs = await this.prisma.transactions.findMany({
      where: {
        receiver_id: userId,
        status: { in: ['PENDING', 'CONFIRMED_BY_SENDER'] },
      },
      select: { item_id: true },
    });

    return txs.map((tx) => tx.item_id);
  }

  /**
   * Get user's browsing history (viewed items in chronological order)
   */
  async getBrowsingHistory(userId: string, limit: number = 20): Promise<string[]> {
    const views = await this.prisma.item_views.findMany({
      where: { user_id: userId },
      select: { item_id: true },
      orderBy: { last_viewed_at: 'desc' },
      take: limit,
    });

    return views.map((v) => v.item_id);
  }
}
