import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserModel } from './models/user.model';
import { UserWithProfileModel } from './models/user-profile.model';
import { UpdateProfileInput } from './dto/update-profile.input';
import { mapUser } from './mappers/user.mapper';
import { PrismaService } from '../prisma/prisma.service';

@Resolver(() => UserModel)
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => UserModel)
  async me(@CurrentUser() fbUser: any) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    return mapUser(dbUser);
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => UserWithProfileModel)
  async meWithProfile(@CurrentUser() fbUser: any) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const userProfile = await this.prisma.user_profiles.findUnique({
      where: { user_id: dbUser.id },
    });

    return {
      ...mapUser(dbUser),
      profile: userProfile ? {
        bio: userProfile.bio,
        city: userProfile.city,
        governorate: userProfile.governorate,
        avatarUrl: userProfile.avatar_url,
      } : null,
    };
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => UserModel)
  async updateProfile(
    @CurrentUser() fbUser: any,
    @Args('input') input: UpdateProfileInput,
  ) {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const updated = await this.usersService.updateProfile(dbUser.id, input);
    return mapUser(updated);
  }
}
