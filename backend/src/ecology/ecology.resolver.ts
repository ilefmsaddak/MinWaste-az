import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver, Mutation } from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { EcologyService } from './ecology.service';

@Resolver()
export class EcologyResolver {
  constructor(
    private readonly ecologyService: EcologyService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => String)
  async userEcologyDashboard(@CurrentUser() fbUser: any): Promise<string> {
    const dbUser = await this.usersService.upsertFromFirebase(fbUser);
    const dashboard = await this.ecologyService.getUserEcologyDashboard(dbUser.id);
    return JSON.stringify(dashboard);
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => String)
  async communityEcologyDashboard(): Promise<string> {
    const dashboard = await this.ecologyService.getCommunityEcologyDashboard();
    return JSON.stringify(dashboard);
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => String)
  async generateMonthlyReport(
    @Args('month', { type: () => Int }) month: number,
    @Args('year', { type: () => Int }) year: number,
  ): Promise<string> {
    const report = await this.ecologyService.generateMonthlyReport(month, year);
    return JSON.stringify(report);
  }

  @UseGuards(FirebaseGqlGuard)
  @Mutation(() => Boolean)
  async initializeEcologyFactors(): Promise<boolean> {
    await this.ecologyService.initializeEcologyFactors();
    return true;
  }
}