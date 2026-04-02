import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UpdateNotificationPreferencesInput } from './dto/preferences.input';
import { UpdatePrivacySettingsInput } from './dto/privacy.input';
import {
  NotificationPreferencesModel,
  PrivacySettingsModel,
  ProfileModel,
} from './models/profile.model';
import { ProfileService } from './profile.service';
import { BadgeProgressEntry } from './models/badge-progress.model';

@Resolver(() => ProfileModel)
export class ProfileResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly profileService: ProfileService,
  ) {}

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        ),
      ),
    ]);
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => ProfileModel)
  async myProfile(@CurrentUser() fbUser: any) {
    const startedAt = Date.now();
    try {
      console.log(`[ProfileResolver] === MY PROFILE START ===`);
      console.log(`[ProfileResolver] Firebase user reçu - uid: ${fbUser?.uid}, email: ${fbUser?.email}`);
      
      const dbUser = await this.withTimeout(
        this.usersService.upsertFromFirebase(fbUser),
        8000,
        'upsertFromFirebase',
      );

      console.log(`[ProfileResolver] ✅ dbUser reçu de upsertFromFirebase:`);
      console.log(`[ProfileResolver] - dbUser.id: ${dbUser.id}`);
      console.log(`[ProfileResolver] - dbUser.email: ${dbUser.email}`);
      console.log(`[ProfileResolver] - dbUser.points: ${dbUser.points}`);
      console.log(`[ProfileResolver] - dbUser.trust_score: ${dbUser.trust_score}`);

      await this.withTimeout(
        this.profileService.ensureBadgesForUser(dbUser.id),
        8000,
        'ensureBadgesForUser',
      );

      console.log(`[ProfileResolver] ✅ ensureBadgesForUser terminé pour user.id: ${dbUser.id}`);

      const profile = await this.withTimeout(
        this.profileService.getProfile(dbUser.id),
        8000,
        'getProfile',
      );

      console.log(`[ProfileResolver] ✅ Profile service retourné:`);
      console.log(`[ProfileResolver] - profile.user.id: ${profile?.user?.id}`);
      console.log(`[ProfileResolver] - profile.user.points: ${profile?.user?.points}`);
      console.log(`[ProfileResolver] - profile.user.trustScore: ${profile?.user?.trustScore}`);
      console.log(`[ProfileResolver] - profile.badges length: ${profile?.badges?.length || 0}`);
      console.log(`[ProfileResolver] - profile.history length: ${profile?.history?.length || 0}`);
      console.log(`[ProfileResolver] - profile.notificationPreferences: ${JSON.stringify(profile?.notificationPreferences)}`);
      console.log(`[ProfileResolver] - profile.privacySettings: ${JSON.stringify(profile?.privacySettings)}`);

      console.log(`[ProfileResolver] ✅ RÉPONSE API BRUTE:`);
      console.log(JSON.stringify(profile, null, 2));

      return profile;
    } catch (e: any) {
      console.warn(
        `[ProfileResolver] ❌ myProfile failed after ${Date.now() - startedAt}ms:`,
        e?.message ?? e,
      );
      throw e;
    }
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => NotificationPreferencesModel)
  async updateNotificationPreferences(
    @CurrentUser() fbUser: any,
    @Args('input') input: UpdateNotificationPreferencesInput,
  ) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return this.profileService.updateNotificationPreferences(dbUser.id, input);
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => [BadgeProgressEntry])
  async badgeProgress(@CurrentUser() fbUser: any) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return this.profileService.getBadgeProgress(dbUser.id);
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => PrivacySettingsModel)
  async updatePrivacySettings(
    @CurrentUser() fbUser: any,
    @Args('input') input: UpdatePrivacySettingsInput,
  ) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return this.profileService.updatePrivacySettings(dbUser.id, input);
  }
}
