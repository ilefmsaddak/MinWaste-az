import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService, KG_FOOD_PER_UNIT } from '../gamification/gamification.service';

export type DashboardPeriodMode = 'week' | 'month' | 'year' | 'all';

export type MonthlyPoint = { period: string; kgCo2: number; moneySavedTnd: number };
export type PointsSeriesPoint = { period: string; points: number };

export type DashboardKpiDelta = {
  metric: 'points' | 'transactions' | 'co2' | 'savings';
  currentValue: number;
  previousValue: number | null;
  deltaPercent: number | null;
};

export type DashboardBadge = {
  code: string;
  name: string;
  earnedAt: string;
};

export type DashboardPointsGain = {
  delta: number;
  actionCode: string;
  createdAt: string;
};

export type DashboardLeaderboardEntry = {
  rank: number;
  displayName: string;
  points: number;
  level: number;
};

export type DashboardLeaderboard = {
  top: DashboardLeaderboardEntry[];
  myRank: number;
  myPoints: number;
};

export type DashboardCityLeaderboard = DashboardLeaderboard & {
  cityLabel: string | null;
};

export type DashboardCommunity = {
  avgKgCo2PerUser: number;
  yourKgCo2: number;
  deltaVsAvgPercent: number;
  percentile: number;
  activeUsersCount: number;
  monthPoints: number;
  avgMonthPointsPerActiveUser: number;
  monthPointsDeltaPercent: number;
  definition: string;
};

export type DashboardData = {
  timezoneLabel: string;
  points: number;
  pointsToday: number;
  level: number;
  levelLabel: string;
  pointsToNextLevel: number;
  nextLevelPoints: number;
  levelProgressPct: number;
  transactionsCompleted: number;
  donationsAsDonor: number;
  donationsAsReceiver: number;
  salesAsSeller: number;
  purchasesAsBuyer: number;
  foodKgRescued: number;
  itemsExchanged: number;
  totalKgCo2Avoided: number;
  totalMoneySavedTnd: number;
  kpiDeltas: DashboardKpiDelta[];
  pointsSeries: PointsSeriesPoint[];
  monthlyCo2Series: MonthlyPoint[];
  community: DashboardCommunity;
  leaderboard: DashboardLeaderboard;
  leaderboardCity: DashboardCityLeaderboard;
  recentBadges: DashboardBadge[];
  recentPointsGains: DashboardPointsGain[];
};

type PeriodRange = {
  start: Date | null;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
  bucket: 'day' | 'month';
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  private levelFromPoints(points: number): number {
    return Math.min(50, Math.floor(points / 100) + 1);
  }

  private levelLabel(level: number): string {
    if (level <= 1) return 'Beginner';
    if (level <= 5) return 'Active';
    if (level <= 15) return 'Committed';
    if (level <= 30) return 'Ambassador';
    return 'Legend';
  }

  private round2(v: number): number {
    return Math.round(v * 100) / 100;
  }

  private txCo2FallbackKg(quantity: number): number {
    return this.gamification.estimateCo2Kg(quantity);
  }

  private savingsFromTx(priceAmount: number | null | undefined, qty: number): number {
    if (priceAmount == null || priceAmount <= 0) return 0;
    return priceAmount * qty;
  }

  private isLikelyTestUser(email: string | null, displayName: string | null): boolean {
    const source = `${email ?? ''} ${displayName ?? ''}`.toLowerCase();
    return (
      source.includes('test') ||
      source.includes('mock') ||
      source.includes('demo') ||
      source.includes('fake')
    );
  }

  private getRange(mode: DashboardPeriodMode): PeriodRange {
    const now = new Date();
    const end = now;
    if (mode === 'week') {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);

      const previousEnd = new Date(start.getTime() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setUTCDate(previousStart.getUTCDate() - 6);
      previousStart.setUTCHours(0, 0, 0, 0);
      return { start, end, previousStart, previousEnd, bucket: 'day' };
    }
    if (mode === 'month') {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);

      const previousEnd = new Date(start.getTime() - 1);
      const previousStart = new Date(previousEnd);
      previousStart.setUTCDate(previousStart.getUTCDate() - 29);
      previousStart.setUTCHours(0, 0, 0, 0);
      return { start, end, previousStart, previousEnd, bucket: 'day' };
    }
    if (mode === 'year') {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

      const previousEnd = new Date(start.getTime() - 1);
      const previousStart = new Date(Date.UTC(previousEnd.getUTCFullYear(), previousEnd.getUTCMonth() - 11, 1));
      return { start, end, previousStart, previousEnd, bucket: 'month' };
    }

    return {
      start: null,
      end,
      previousStart: null,
      previousEnd: null,
      bucket: 'month',
    };
  }

  private pctDelta(current: number, previous: number | null): number | null {
    if (previous == null) return null;
    if (previous === 0) {
      if (current === 0) return 0;
      return 100;
    }
    return this.round2(((current - previous) / previous) * 100);
  }

  private async getValidatedPointsTotal(userId: string): Promise<number> {
    const agg = await this.prisma.points_ledger.aggregate({
      where: { user_id: userId },
      _sum: { delta: true },
    });
    if (agg._sum.delta != null) {
      return Math.max(0, agg._sum.delta);
    }
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    return user?.points ?? 0;
  }

  private async getPointsGained(userId: string, start: Date, end: Date): Promise<number> {
    const rows = await this.prisma.points_ledger.findMany({
      where: {
        user_id: userId,
        created_at: { gte: start, lte: end },
      },
      select: { delta: true },
    });
    return rows.reduce((sum, row) => sum + (row.delta > 0 ? row.delta : 0), 0);
  }

  private async getPointsSeries(userId: string, mode: DashboardPeriodMode): Promise<PointsSeriesPoint[]> {
    const range = this.getRange(mode);
    const buckets = new Map<string, number>();
    const now = new Date();

    if (range.start && range.bucket === 'day') {
      const days = mode === 'week' ? 7 : 30;
      const t0 = range.start.getTime();
      const dayMs = 86400000;
      for (let i = 0; i < days; i++) {
        const d = new Date(t0 + i * dayMs);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }
    } else {
      let from: Date;
      if (range.start) {
        from = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
      } else {
        const firstLedger = await this.prisma.points_ledger.findFirst({
          where: { user_id: userId },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        });
        from = firstLedger
          ? new Date(Date.UTC(firstLedger.created_at.getUTCFullYear(), firstLedger.created_at.getUTCMonth(), 1))
          : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
      }
      const cursor = new Date(from);
      const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      while (cursor <= until) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
        buckets.set(key, 0);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }

    const where: any = { user_id: userId };
    if (range.start) {
      where.created_at = { gte: range.start, lte: range.end };
    }
    const rows = await this.prisma.points_ledger.findMany({
      where,
      select: { created_at: true, delta: true },
    });

    for (const row of rows) {
      const delta = row.delta > 0 ? row.delta : 0;
      const d = new Date(row.created_at);
      const key = range.bucket === 'day'
        ? d.toISOString().slice(0, 10)
        : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + delta);
      }
    }

    return Array.from(buckets.entries()).map(([period, points]) => ({ period, points }));
  }

  private async getMonthlyCo2Series(userId: string, months = 12): Promise<MonthlyPoint[]> {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

    const impacts = await this.prisma.transaction_impacts.findMany({
      where: {
        completed_at: { gte: start },
        OR: [{ owner_id: userId }, { receiver_id: userId }],
      },
      select: {
        completed_at: true,
        co2_saved_kg: true,
      },
    });

    const txs = await this.prisma.transactions.findMany({
      where: {
        status: 'COMPLETED',
        updated_at: { gte: start },
        OR: [{ owner_id: userId }, { receiver_id: userId }],
      } as any,
      include: {
        items: {
          select: {
            price_amount: true,
            price_type: true,
          },
        },
      },
    });

    const map = new Map<string, { kgCo2: number; moneySavedTnd: number }>();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      map.set(key, { kgCo2: 0, moneySavedTnd: 0 });
    }

    for (const impact of impacts) {
      const d = new Date(impact.completed_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(key);
      if (!cur) continue;
      cur.kgCo2 += Number(impact.co2_saved_kg);
    }

    for (const tx of txs as any[]) {
      const d = new Date(tx.updated_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(key);
      if (!cur) continue;
      if (tx.receiver_id !== userId) continue;

      const qty = tx.quantity ?? 0;
      const amount = tx.items?.price_amount != null ? Number(tx.items.price_amount) : null;
      cur.moneySavedTnd += this.savingsFromTx(amount, qty);
    }

    return Array.from(map.entries()).map(([period, value]) => ({
      period,
      kgCo2: this.round2(value.kgCo2),
      moneySavedTnd: this.round2(value.moneySavedTnd),
    }));
  }

  private async getRecentBadges(userId: string, limit = 4): Promise<DashboardBadge[]> {
    const rows = await this.prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: true },
      orderBy: { earned_at: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      code: row.badges.code,
      name: row.badges.name,
      earnedAt: row.earned_at.toISOString(),
    }));
  }

  private async getRecentPointsGains(userId: string, limit = 8): Promise<DashboardPointsGain[]> {
    const rows = await this.prisma.points_ledger.findMany({
      where: { user_id: userId, delta: { gt: 0 } },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: { delta: true, action_code: true, created_at: true },
    });
    return rows.map((row) => ({
      delta: row.delta,
      actionCode: row.action_code,
      createdAt: row.created_at.toISOString(),
    }));
  }

  private rankUsers<T extends { id: string; points: number; display_name?: string | null }>(
    users: T[],
  ): Map<string, { rank: number; points: number; displayName: string }> {
    const sorted = [...users].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.id.localeCompare(b.id);
    });

    const map = new Map<string, { rank: number; points: number; displayName: string }>();
    let previousPoints: number | null = null;
    let currentRank = 0;

    for (let i = 0; i < sorted.length; i++) {
      const user = sorted[i];
      if (previousPoints == null || user.points < previousPoints) {
        currentRank = i + 1;
        previousPoints = user.points;
      }
      map.set(user.id, {
        rank: currentRank,
        points: user.points,
        displayName: user.display_name?.trim() || 'User',
      });
    }
    return map;
  }

  private async getLeaderboardData(
    userId: string,
    cityLabel?: string | null,
  ): Promise<DashboardLeaderboard | DashboardCityLeaderboard> {
    let scopeIds: string[] | null = null;
    if (cityLabel) {
      const peers = await this.prisma.user_profiles.findMany({
        where: {
          city: { equals: cityLabel, mode: 'insensitive' },
        } as any,
        select: { user_id: true },
      });
      scopeIds = peers.map((x) => x.user_id);
      if (!scopeIds.length) {
        const me = await this.prisma.users.findUnique({
          where: { id: userId },
          select: { points: true },
        });
        return { top: [], myRank: 0, myPoints: me?.points ?? 0, cityLabel };
      }
    }

    const users = await this.prisma.users.findMany({
      where: {
        is_suspended: false,
        ...(scopeIds ? { id: { in: scopeIds } } : {}),
      },
      select: { id: true, display_name: true, points: true, email: true },
    });

    const eligible = users.filter((u) => !this.isLikelyTestUser(u.email, u.display_name));
    const ranks = this.rankUsers(eligible);

    const top = eligible
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.id.localeCompare(b.id);
      })
      .slice(0, 5)
      .map((u) => ({
        rank: ranks.get(u.id)?.rank ?? 0,
        displayName: u.display_name?.trim() || 'User',
        points: u.points,
        level: this.levelFromPoints(u.points),
      }));

    const myEntry = ranks.get(userId);
    const myPoints = myEntry?.points ??
      (await this.prisma.users.findUnique({
        where: { id: userId },
        select: { points: true },
      }))?.points ??
      0;

    if (cityLabel !== undefined) {
      return {
        top,
        myRank: myEntry?.rank ?? 0,
        myPoints,
        cityLabel,
      };
    }

    return {
      top,
      myRank: myEntry?.rank ?? 0,
      myPoints,
    };
  }

  private async getCommunity(userId: string, yourKgCo2: number): Promise<DashboardCommunity> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const impacts = await this.prisma.transaction_impacts.findMany({
      select: { owner_id: true, receiver_id: true, co2_saved_kg: true },
    });

    const activeUserIds = new Set<string>();
    for (const impact of impacts) {
      activeUserIds.add(impact.owner_id);
      activeUserIds.add(impact.receiver_id);
    }

    if (!activeUserIds.size) {
      return {
        avgKgCo2PerUser: 0,
        yourKgCo2,
        deltaVsAvgPercent: 0,
        percentile: 0,
        activeUsersCount: 0,
        monthPoints: 0,
        avgMonthPointsPerActiveUser: 0,
        monthPointsDeltaPercent: 0,
        definition:
          'Active user = non-suspended user with at least one completed transaction. Test/mock/demo profiles are excluded.',
      };
    }

    const users = await this.prisma.users.findMany({
      where: { id: { in: Array.from(activeUserIds) }, is_suspended: false },
      select: { id: true, points: true, email: true, display_name: true },
    });

    const eligibleUsers = users.filter((u) => !this.isLikelyTestUser(u.email, u.display_name));
    const eligibleIds = new Set(eligibleUsers.map((u) => u.id));

    const co2ByUser = new Map<string, number>();
    for (const impact of impacts) {
      const co2 = Number(impact.co2_saved_kg);
      if (eligibleIds.has(impact.owner_id)) {
        co2ByUser.set(impact.owner_id, (co2ByUser.get(impact.owner_id) ?? 0) + co2);
      }
      if (eligibleIds.has(impact.receiver_id)) {
        co2ByUser.set(impact.receiver_id, (co2ByUser.get(impact.receiver_id) ?? 0) + co2);
      }
    }

    const co2Values = Array.from(co2ByUser.values());
    const totalCo2 = co2Values.reduce((a, b) => a + b, 0);
    const avgKgCo2PerUser = co2Values.length ? totalCo2 / co2Values.length : 0;
    const deltaVsAvgPercent = avgKgCo2PerUser > 0
      ? ((yourKgCo2 - avgKgCo2PerUser) / avgKgCo2PerUser) * 100
      : 0;

    const sortedPoints = eligibleUsers.map((u) => u.points).sort((a, b) => a - b);
    const me = eligibleUsers.find((u) => u.id === userId);
    const myPoints = me?.points ?? 0;
    const usersBelow = sortedPoints.filter((p) => p < myPoints).length;
    const percentile = sortedPoints.length ? (usersBelow / sortedPoints.length) * 100 : 0;

    const monthRows = await this.prisma.points_ledger.findMany({
      where: {
        user_id: { in: Array.from(eligibleIds) },
        created_at: { gte: monthStart },
        delta: { gt: 0 },
      },
      select: { user_id: true, delta: true },
    });

    const monthByUser = new Map<string, number>();
    for (const row of monthRows) {
      monthByUser.set(row.user_id, (monthByUser.get(row.user_id) ?? 0) + row.delta);
    }

    const monthPoints = monthByUser.get(userId) ?? 0;
    const avgMonthPointsPerActiveUser = eligibleIds.size
      ? Array.from(monthByUser.values()).reduce((a, b) => a + b, 0) / eligibleIds.size
      : 0;
    const monthPointsDeltaPercent = avgMonthPointsPerActiveUser > 0
      ? ((monthPoints - avgMonthPointsPerActiveUser) / avgMonthPointsPerActiveUser) * 100
      : 0;

    return {
      avgKgCo2PerUser: this.round2(avgKgCo2PerUser),
      yourKgCo2: this.round2(yourKgCo2),
      deltaVsAvgPercent: this.round2(deltaVsAvgPercent),
      percentile: this.round2(percentile),
      activeUsersCount: eligibleIds.size,
      monthPoints,
      avgMonthPointsPerActiveUser: this.round2(avgMonthPointsPerActiveUser),
      monthPointsDeltaPercent: this.round2(monthPointsDeltaPercent),
      definition:
        'Active user = non-suspended user with at least one completed transaction. Test/mock/demo profiles are excluded.',
    };
  }

  async getDashboardData(userId: string, mode: DashboardPeriodMode): Promise<DashboardData> {
    const range = this.getRange(mode);
    const utcDayStart = new Date();
    utcDayStart.setUTCHours(0, 0, 0, 0);

    const txWhere: any = {
      status: 'COMPLETED',
      OR: [{ owner_id: userId }, { receiver_id: userId }],
    };
    if (range.start) {
      txWhere.updated_at = { gte: range.start, lte: range.end };
    }

    const txWherePrevious: any = {
      status: 'COMPLETED',
      OR: [{ owner_id: userId }, { receiver_id: userId }],
    };
    if (range.previousStart && range.previousEnd) {
      txWherePrevious.updated_at = { gte: range.previousStart, lte: range.previousEnd };
    }

    const impactsWhere: any = {
      OR: [{ owner_id: userId }, { receiver_id: userId }],
    };
    if (range.start) {
      impactsWhere.completed_at = { gte: range.start, lte: range.end };
    }

    const impactsPrevWhere: any = {
      OR: [{ owner_id: userId }, { receiver_id: userId }],
    };
    if (range.previousStart && range.previousEnd) {
      impactsPrevWhere.completed_at = { gte: range.previousStart, lte: range.previousEnd };
    }

    const [points, pointsToday, txs, impacts, monthlyCo2Series, pointsSeries, recentBadges, recentPointsGains, profile] =
      await Promise.all([
        this.getValidatedPointsTotal(userId),
        this.getPointsGained(userId, utcDayStart, new Date()),
        this.prisma.transactions.findMany({
          where: txWhere,
          include: {
            items: {
              select: { id: true, type: true, price_type: true, price_amount: true },
            },
          },
        }),
        this.prisma.transaction_impacts.findMany({
          where: impactsWhere,
          select: {
            transaction_id: true,
            category: true,
            quantity: true,
            food_saved_kg: true,
            co2_saved_kg: true,
          },
        }),
        this.getMonthlyCo2Series(userId, 12),
        this.getPointsSeries(userId, mode),
        this.getRecentBadges(userId),
        this.getRecentPointsGains(userId),
        this.prisma.user_profiles.findUnique({ where: { user_id: userId }, select: { city: true } }),
      ]);

    const previousTxs =
      range.previousStart && range.previousEnd
        ? await this.prisma.transactions.findMany({
            where: txWherePrevious,
            include: {
              items: {
                select: { type: true, price_type: true, price_amount: true },
              },
            },
          })
        : [];

    const previousImpacts =
      range.previousStart && range.previousEnd
        ? await this.prisma.transaction_impacts.findMany({
            where: impactsPrevWhere,
            select: { co2_saved_kg: true },
          })
        : [];

    const impactByTxId = new Map(impacts.map((i) => [i.transaction_id, i]));

    let transactionsCompleted = 0;
    let donationsAsDonor = 0;
    let donationsAsReceiver = 0;
    let salesAsSeller = 0;
    let purchasesAsBuyer = 0;
    let foodKgRescued = 0;
    let itemsExchanged = 0;
    let totalMoneySavedTnd = 0;
    let totalKgCo2Avoided = 0;

    for (const tx of txs as any[]) {
      transactionsCompleted += 1;
      const qty = tx.quantity ?? 0;
      const priceType = String(tx.items?.price_type ?? 'FREE');
      const amount = tx.items?.price_amount != null ? Number(tx.items.price_amount) : null;

      if (priceType === 'FREE') {
        if (tx.owner_id === userId) donationsAsDonor += 1;
        if (tx.receiver_id === userId) donationsAsReceiver += 1;
      } else {
        if (tx.owner_id === userId) salesAsSeller += 1;
        if (tx.receiver_id === userId) purchasesAsBuyer += 1;
      }

      if (tx.receiver_id === userId) {
        totalMoneySavedTnd += this.savingsFromTx(amount, qty);
      }

      const impact = impactByTxId.get(tx.id);
      if (impact) {
        totalKgCo2Avoided += Number(impact.co2_saved_kg);
        if (String(impact.category).toUpperCase() === 'FOOD') {
          foodKgRescued += Number(impact.food_saved_kg);
        } else {
          itemsExchanged += Number(impact.quantity ?? qty);
        }
      } else {
        totalKgCo2Avoided += this.txCo2FallbackKg(qty);
        if (String(tx.items?.type ?? '').toUpperCase() === 'FOOD') {
          foodKgRescued += qty * KG_FOOD_PER_UNIT;
        } else {
          itemsExchanged += qty;
        }
      }
    }

    const currentPointsWindow = range.start
      ? await this.getPointsGained(userId, range.start, range.end)
      : points;
    const previousPointsWindow =
      range.previousStart && range.previousEnd
        ? await this.getPointsGained(userId, range.previousStart, range.previousEnd)
        : null;

    const previousCo2 = previousImpacts.reduce((sum, impact) => sum + Number(impact.co2_saved_kg), 0);
    const previousSavings = previousTxs.reduce((sum, tx: any) => {
      if (tx.receiver_id !== userId) return sum;
      const qty = tx.quantity ?? 0;
      const amount = tx.items?.price_amount != null ? Number(tx.items.price_amount) : null;
      return sum + this.savingsFromTx(amount, qty);
    }, 0);

    const level = this.levelFromPoints(points);
    const currentLevelFloor = (level - 1) * 100;
    const nextLevelPoints = level >= 50 ? points : level * 100;
    const pointsToNextLevel = Math.max(0, nextLevelPoints - points);
    const levelProgressPct = level >= 50
      ? 100
      : this.round2(((points - currentLevelFloor) / 100) * 100);

    const community = await this.getCommunity(userId, totalKgCo2Avoided);
    const leaderboard = (await this.getLeaderboardData(userId)) as DashboardLeaderboard;
    const cityLabel = profile?.city?.trim() || null;
    const leaderboardCity = (await this.getLeaderboardData(userId, cityLabel)) as DashboardCityLeaderboard;

    return {
      timezoneLabel: 'UTC',
      points,
      pointsToday,
      level,
      levelLabel: this.levelLabel(level),
      pointsToNextLevel,
      nextLevelPoints,
      levelProgressPct,
      transactionsCompleted,
      donationsAsDonor,
      donationsAsReceiver,
      salesAsSeller,
      purchasesAsBuyer,
      foodKgRescued: this.round2(foodKgRescued),
      itemsExchanged,
      totalKgCo2Avoided: this.round2(totalKgCo2Avoided),
      totalMoneySavedTnd: this.round2(totalMoneySavedTnd),
      kpiDeltas: [
        {
          metric: 'points',
          currentValue: currentPointsWindow,
          previousValue: previousPointsWindow,
          deltaPercent: this.pctDelta(currentPointsWindow, previousPointsWindow),
        },
        {
          metric: 'transactions',
          currentValue: transactionsCompleted,
          previousValue: range.previousStart ? previousTxs.length : null,
          deltaPercent: this.pctDelta(transactionsCompleted, range.previousStart ? previousTxs.length : null),
        },
        {
          metric: 'co2',
          currentValue: this.round2(totalKgCo2Avoided),
          previousValue: range.previousStart ? this.round2(previousCo2) : null,
          deltaPercent: this.pctDelta(totalKgCo2Avoided, range.previousStart ? previousCo2 : null),
        },
        {
          metric: 'savings',
          currentValue: this.round2(totalMoneySavedTnd),
          previousValue: range.previousStart ? this.round2(previousSavings) : null,
          deltaPercent: this.pctDelta(totalMoneySavedTnd, range.previousStart ? previousSavings : null),
        },
      ],
      pointsSeries,
      monthlyCo2Series,
      community,
      leaderboard,
      leaderboardCity,
      recentBadges,
      recentPointsGains,
    };
  }

  buildCsvExport(userId: string, data: DashboardData): string {
    const lines = [
      'MinWaste Dashboard Export',
      `User ID,${userId}`,
      `Timezone,${data.timezoneLabel}`,
      `Total points,${data.points}`,
      `Points today,${data.pointsToday}`,
      `Level,${data.level}`,
      `Points to next level,${data.pointsToNextLevel}`,
      `Transactions completed,${data.transactionsCompleted}`,
      `Donations as donor,${data.donationsAsDonor}`,
      `Donations as receiver,${data.donationsAsReceiver}`,
      `Sales as seller,${data.salesAsSeller}`,
      `Purchases as buyer,${data.purchasesAsBuyer}`,
      `Food rescued (kg),${data.foodKgRescued}`,
      `Items exchanged,${data.itemsExchanged}`,
      `CO2 avoided (kg),${data.totalKgCo2Avoided}`,
      `Savings (TND),${data.totalMoneySavedTnd}`,
      `Global rank,${data.leaderboard.myRank}`,
      `City rank,${data.leaderboardCity.myRank}`,
      '',
      'Points Series',
      'Period,Points',
      ...data.pointsSeries.map((row) => `${row.period},${row.points}`),
      '',
      'Monthly CO2 + Savings',
      'Month,CO2 kg,Savings TND',
      ...data.monthlyCo2Series.map((row) => `${row.period},${row.kgCo2},${row.moneySavedTnd}`),
      '',
      'Recent Point Gains',
      'Date,Action,Delta',
      ...data.recentPointsGains.map((row) => `${row.createdAt},${row.actionCode},${row.delta}`),
    ];
    return lines.join('\n');
  }
}
