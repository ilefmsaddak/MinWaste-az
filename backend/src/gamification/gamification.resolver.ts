import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  Int,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { GamificationService } from './gamification.service';
import { POINT_RULES } from './gamification-rules';

const RULE_DESCRIPTIONS: Record<string, string> = {
  GIVE_LISTING: 'Publier une annonce de don',
  CONFIRM_DONATION: 'Confirmer la remise du don',
  DONOR_ON_COMPLETE: 'Clôture don (donneur)',
  RECEIVER_ON_COMPLETE_FREE: 'Clôture don (bénéficiaire)',
  SELL_ON_COMPLETE: 'Clôture vente (vendeur)',
  BUY_ON_COMPLETE: 'Clôture vente (acheteur)',
};

@ObjectType()
export class PointRuleGql {
  @Field() key: string;
  @Field() actionCode: string;
  @Field(() => Int) points: number;
  @Field({ nullable: true }) description?: string;
}

@ObjectType()
export class PointsLedgerEntryGql {
  @Field() id: string;
  @Field(() => Int) delta: number;
  @Field(() => Int) balanceAfter: number;
  @Field() actionCode: string;
  @Field({ nullable: true }) refType?: string;
  @Field({ nullable: true }) refId?: string;
  @Field() createdAt: Date;
}

@Resolver()
export class GamificationResolver {
  constructor(
    private readonly users: UsersService,
    private readonly gamification: GamificationService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => [PointRuleGql])
  pointRules(): PointRuleGql[] {
    return (Object.keys(POINT_RULES) as Array<keyof typeof POINT_RULES>).map(
      (key) => ({
        key,
        actionCode: key,
        points: POINT_RULES[key],
        description: RULE_DESCRIPTIONS[key] ?? String(key),
      }),
    );
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => Int)
  async myPointsToday(@CurrentUser() fbUser: any): Promise<number> {
    const u = await this.users.upsertFromFirebase(fbUser);
    return this.gamification.pointsToday(u.id);
  }

  @UseGuards(FirebaseGqlGuard)
  @Query(() => [PointsLedgerEntryGql])
  async myPointsLedger(
    @CurrentUser() fbUser: any,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 50 })
    take: number,
  ): Promise<PointsLedgerEntryGql[]> {
    const u = await this.users.upsertFromFirebase(fbUser);
    const rows = await this.gamification.pointsHistory(u.id, take);
    return rows.map((r) => ({
      id: r.id,
      delta: r.delta,
      balanceAfter: r.balance_after,
      actionCode: r.action_code,
      refType: r.ref_type ?? undefined,
      refId: r.ref_id ?? undefined,
      createdAt: r.created_at,
    }));
  }
}
