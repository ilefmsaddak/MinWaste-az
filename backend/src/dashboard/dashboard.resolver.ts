import { UseGuards } from '@nestjs/common';
import {
  Args,
  Field,
  Float,
  Int,
  ObjectType,
  Query,
  registerEnumType,
  Resolver,
} from '@nestjs/graphql';
import { FirebaseGqlGuard } from '../auth/guards/firebase-gql.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { DashboardService } from './dashboard.service';
import { DashboardPeriodMode } from './dashboard.service';

export enum DashboardSeriesPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
  ALL = 'ALL',
}

registerEnumType(DashboardSeriesPeriod, {
  name: 'DashboardSeriesPeriod',
  description: 'Période du dashboard (7j, 30j, 12 mois, tout)',
});

function seriesMode(
  p: DashboardSeriesPeriod,
): DashboardPeriodMode {
  if (p === DashboardSeriesPeriod.WEEK) return 'week';
  if (p === DashboardSeriesPeriod.MONTH) return 'month';
  if (p === DashboardSeriesPeriod.YEAR) return 'year';
  return 'all';
}

@ObjectType()
export class MonthlySeriesPointGql {
  @Field() period: string;
  @Field(() => Float) kgCo2: number;
  @Field(() => Float) moneySavedTnd: number;
}

@ObjectType()
export class KpiDeltaGql {
  @Field() metric: string;
  @Field(() => Float) currentValue: number;
  @Field(() => Float, { nullable: true }) previousValue?: number;
  @Field(() => Float, { nullable: true }) deltaPercent?: number;
}

@ObjectType()
export class RecentBadgeGql {
  @Field() code: string;
  @Field() name: string;
  @Field() earnedAt: string;
}

@ObjectType()
export class RecentPointsGainGql {
  @Field(() => Int) delta: number;
  @Field() actionCode: string;
  @Field() createdAt: string;
}

@ObjectType()
export class LeaderboardEntryGql {
  @Field(() => Int) rank: number;
  @Field() displayName: string;
  @Field(() => Int) points: number;
  @Field(() => Int) level: number;
}

@ObjectType()
export class LeaderboardGql {
  @Field(() => [LeaderboardEntryGql]) top: LeaderboardEntryGql[];
  @Field(() => Int) myRank: number;
  @Field(() => Int) myPoints: number;
}

@ObjectType()
export class LeaderboardCityGql {
  @Field(() => [LeaderboardEntryGql]) top: LeaderboardEntryGql[];
  @Field(() => Int) myRank: number;
  @Field(() => Int) myPoints: number;
  @Field({ nullable: true }) cityLabel?: string;
}

@ObjectType()
export class PointsSeriesPointGql {
  @Field() period: string;
  @Field(() => Int) points: number;
}

@ObjectType()
export class CommunityBenchmarkGql {
  @Field(() => Float) avgKgCo2PerUser: number;
  @Field(() => Float) yourKgCo2: number;
  @Field(() => Float) deltaVsAvgPercent: number;
  @Field(() => Float) percentile: number;
  @Field(() => Int) activeUsersCount: number;
  @Field(() => Int) monthPoints: number;
  @Field(() => Float) avgMonthPointsPerActiveUser: number;
  @Field(() => Float) monthPointsDeltaPercent: number;
  @Field() definition: string;
}

@ObjectType()
export class DashboardGql {
  @Field() timezoneLabel: string;
  @Field(() => Int) points: number;
  @Field(() => Int) level: number;
  @Field() levelLabel: string;
  @Field(() => Int) pointsToday: number;
  @Field(() => Int) pointsToNextLevel: number;
  @Field(() => Int) nextLevelPoints: number;
  @Field(() => Float) levelProgressPct: number;
  @Field(() => Float) foodKgRescued: number;
  @Field(() => Int) itemsExchanged: number;
  @Field(() => Float) totalKgCo2Avoided: number;
  @Field(() => Float) totalMoneySavedTnd: number;
  @Field(() => Int) transactionsCompleted: number;
  @Field(() => Int) donationsAsDonor: number;
  @Field(() => Int) donationsAsReceiver: number;
  @Field(() => Int) salesAsSeller: number;
  @Field(() => Int) purchasesAsBuyer: number;
  @Field(() => [KpiDeltaGql]) kpiDeltas: KpiDeltaGql[];
  @Field(() => [PointsSeriesPointGql]) pointsSeries: PointsSeriesPointGql[];
  @Field(() => [MonthlySeriesPointGql]) monthlyCo2Series: MonthlySeriesPointGql[];
  @Field(() => CommunityBenchmarkGql) community: CommunityBenchmarkGql;
  @Field(() => LeaderboardGql) leaderboard: LeaderboardGql;
  @Field(() => LeaderboardCityGql) leaderboardCity: LeaderboardCityGql;
  @Field(() => [RecentBadgeGql]) recentBadges: RecentBadgeGql[];
  @Field(() => [RecentPointsGainGql]) recentPointsGains: RecentPointsGainGql[];
}

@Resolver(() => DashboardGql)
export class DashboardResolver {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly users: UsersService,
  ) {}

  @UseGuards(FirebaseGqlGuard)
  @Query(() => DashboardGql)
  async myDashboard(
    @CurrentUser() fbUser: any,
    @Args('pointsSeriesPeriod', {
      type: () => DashboardSeriesPeriod,
      nullable: true,
      defaultValue: DashboardSeriesPeriod.MONTH,
    })
    pointsSeriesPeriod: DashboardSeriesPeriod,
  ): Promise<DashboardGql> {
    const user = await this.users.upsertFromFirebase(fbUser);
    const data = await this.dashboard.getDashboardData(
      user.id,
      seriesMode(pointsSeriesPeriod),
    );

    return {
      timezoneLabel: data.timezoneLabel,
      points: data.points,
      level: data.level,
      levelLabel: data.levelLabel,
      pointsToday: data.pointsToday,
      pointsToNextLevel: data.pointsToNextLevel,
      nextLevelPoints: data.nextLevelPoints,
      levelProgressPct: data.levelProgressPct,
      foodKgRescued: data.foodKgRescued,
      itemsExchanged: data.itemsExchanged,
      totalKgCo2Avoided: data.totalKgCo2Avoided,
      totalMoneySavedTnd: data.totalMoneySavedTnd,
      transactionsCompleted: data.transactionsCompleted,
      donationsAsDonor: data.donationsAsDonor,
      donationsAsReceiver: data.donationsAsReceiver,
      salesAsSeller: data.salesAsSeller,
      purchasesAsBuyer: data.purchasesAsBuyer,
      kpiDeltas: data.kpiDeltas.map((k) => ({
        metric: k.metric,
        currentValue: k.currentValue,
        previousValue: k.previousValue ?? undefined,
        deltaPercent: k.deltaPercent ?? undefined,
      })),
      pointsSeries: data.pointsSeries,
      monthlyCo2Series: data.monthlyCo2Series,
      community: data.community,
      leaderboard: data.leaderboard,
      leaderboardCity: {
        ...data.leaderboardCity,
        cityLabel: data.leaderboardCity.cityLabel ?? undefined,
      },
      recentBadges: data.recentBadges,
      recentPointsGains: data.recentPointsGains,
    };
  }
}
