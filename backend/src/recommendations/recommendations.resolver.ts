import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { RecommendationsService } from './recommendations.service';
import {
  RecommendationItemDto,
  RecommendationsResponseDto,
} from './dto/recommendation.dto';

@Resolver()
export class RecommendationsResolver {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Track an item view for the current user
   */
  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async trackItemView(
    @CurrentUser() fbUser: any,
    @Args('itemId') itemId: string,
  ): Promise<boolean> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    await this.recommendationsService.trackItemView(dbUser.id, itemId);
    return true;
  }

  /**
   * Get personalized recommendations for the current user
   * Returns recommendation items with scores and reasons
   */
  @UseGuards(FirebaseGqlGuard)
  @Query(() => RecommendationsResponseDto)
  async recommendedItems(
    @CurrentUser() fbUser: any,
    @Args('limit', { type: () => Int, defaultValue: 10 }) limit: number,
  ): Promise<RecommendationsResponseDto> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return this.recommendationsService.getRecommendedItems(dbUser.id, limit);
  }

  /**
   * Get user's browsing history (viewed items in reverse chronological order)
   */
  @UseGuards(FirebaseGqlGuard)
  @Query(() => [String])
  async browsingHistory(
    @CurrentUser() fbUser: any,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
  ): Promise<string[]> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return this.recommendationsService.getBrowsingHistory(dbUser.id, limit);
  }
}
