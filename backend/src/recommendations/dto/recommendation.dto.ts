import { ObjectType, Field, Float } from '@nestjs/graphql';

/**
 * A single recommended item with scoring details
 */
@ObjectType('RecommendationItem')
export class RecommendationItemDto {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  category?: string | null;

  @Field(() => [String])
  photos: string[];

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field()
  priceType: string;

  @Field(() => Float, { nullable: true })
  priceAmount?: number;

  @Field(() => String, { nullable: true })
  currency?: string;

  @Field(() => Float)
  score: number;

  @Field()
  reason: string;

  @Field()
  reasonCode:
    | 'CATEGORY_MATCH'
    | 'LOCATION_MATCH'
    | 'BROWSING_PATTERN'
    | 'TRENDING'
    | 'MULTIPLE_SIGNALS';
}

/**
 * The complete recommendations response
 */
@ObjectType('RecommendationsResponse')
export class RecommendationsResponseDto {
  @Field(() => [RecommendationItemDto])
  items: RecommendationItemDto[];

  @Field()
  hasMore: boolean;

  @Field()
  generatedAt: Date;

  @Field({ nullable: true })
  message?: string;
}

/**
 * User category preference information
 */
export interface CategoryPreference {
  category: string;
  score: number;
  sources: {
    viewCount: number;
    favoriteCount: number;
    transactionCount: number;
  };
}

/**
 * User location preference information
 */
export interface LocationPreference {
  neighborhood?: string;
  city?: string;
  frequency: number;
  lat?: number;
  lng?: number;
}

/**
 * Recommendation score breakdown
 */
export interface RecommendationScore {
  itemId: string;
  title: string;
  address?: string | null;
  photos: string[];
  priceType: string;
  priceAmount?: number;
  currency?: string;
  description?: string | null;
  category?: string | null;
  categoryAffinity: number;
  locationAffinity: number;
  browsingSimility: number;
  freshnessScore: number;
  totalScore: number;
  reasonCode:
    | 'CATEGORY_MATCH'
    | 'LOCATION_MATCH'
    | 'BROWSING_PATTERN'
    | 'TRENDING'
    | 'MULTIPLE_SIGNALS';
}
