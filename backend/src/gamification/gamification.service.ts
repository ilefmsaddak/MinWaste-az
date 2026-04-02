import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Legacy constants for backward compatibility
export const KG_FOOD_PER_UNIT = 1.0;
export const CO2_PER_KG_FOOD = 2.5;

interface BadgeRule {
  code: string;
  name: string;
  description: string;
  criteria: {
    type: 'donations' | 'sales' | 'points' | 'food_saved' | 'co2_saved';
    threshold: number;
    role?: 'owner' | 'receiver';
  };
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Award points when transaction is finalized
   */
  async awardTransactionPoints(transactionId: string): Promise<void> {
    const transaction = await this.prisma.transactions.findUnique({
      where: { id: transactionId },
      include: {
        items: { select: { price_type: true } },
      },
    });

    if (!transaction || !['COMPLETED', 'CONFIRMED_BY_SENDER'].includes(transaction.status)) {
      return;
    }

    const isDonation = transaction.items.price_type === 'FREE';
    
    // Award points based on transaction type
    if (isDonation) {
      // Donation: donor +20, receiver +10
      await this.awardPoints(transaction.owner_id, 20, 'DONATION_GIVEN', transactionId);
      await this.awardPoints(transaction.receiver_id, 10, 'DONATION_RECEIVED', transactionId);
    } else {
      // Sale: seller +15, buyer +15
      await this.awardPoints(transaction.owner_id, 15, 'SALE_COMPLETED', transactionId);
      await this.awardPoints(transaction.receiver_id, 15, 'PURCHASE_COMPLETED', transactionId);
    }

    // Refresh badges for both users
    await this.refreshUserBadges(transaction.owner_id);
    await this.refreshUserBadges(transaction.receiver_id);

    this.logger.log(`Points awarded for transaction: ${transactionId}`);
  }

  /**
   * Award points to user (idempotent)
   */
  async awardPoints(
    userId: string,
    delta: number,
    actionCode: string,
    refId: string,
  ): Promise<void> {
    const idempotencyKey = `${actionCode}_${refId}_${userId}`;

    // Check if already awarded
    const existing = await this.prisma.points_ledger.findUnique({
      where: { idempotency_key: idempotencyKey },
    });

    if (existing) {
      this.logger.warn(`Points already awarded: ${idempotencyKey}`);
      return;
    }

    // Get current user points
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const newBalance = user.points + delta;

    // Create points ledger entry and update user points in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.points_ledger.create({
        data: {
          user_id: userId,
          delta,
          balance_after: newBalance,
          action_code: actionCode,
          ref_type: 'TRANSACTION',
          ref_id: refId,
          idempotency_key: idempotencyKey,
        },
      });

      await tx.users.update({
        where: { id: userId },
        data: { points: newBalance },
      });
    });

    this.logger.log(`Points awarded: ${userId} +${delta} (${actionCode})`);
  }

  /**
   * Initialize default badges
   */
  async initializeBadges(): Promise<void> {
    const badgeRules: BadgeRule[] = [
      {
        code: 'DONATEUR_NOVICE',
        name: 'Donateur Novice',
        description: 'Complete 5 donations as donor',
        criteria: { type: 'donations', threshold: 5, role: 'owner' },
      },
      {
        code: 'SUPER_DONATEUR',
        name: 'Super Donateur',
        description: 'Complete 20 donations as donor',
        criteria: { type: 'donations', threshold: 20, role: 'owner' },
      },
      {
        code: 'VENDEUR_SOLIDAIRE',
        name: 'Vendeur Solidaire',
        description: 'Complete 10 sales as seller',
        criteria: { type: 'sales', threshold: 10, role: 'owner' },
      },
      {
        code: 'CIVIC_HERO',
        name: 'Civic Hero',
        description: 'Reach 50 total points',
        criteria: { type: 'points', threshold: 50 },
      },
      {
        code: 'QUARTIER_PROPRE',
        name: 'Quartier Propre',
        description: 'Save 50 kg of food in your neighborhood',
        criteria: { type: 'food_saved', threshold: 50 },
      },
      {
        code: 'ECO_CITOYEN',
        name: 'Éco-Citoyen',
        description: 'Avoid 100 kg of CO2 emissions',
        criteria: { type: 'co2_saved', threshold: 100 },
      },
    ];

    for (const rule of badgeRules) {
      await this.prisma.badges.upsert({
        where: { code: rule.code },
        update: {},
        create: {
          code: rule.code,
          name: rule.name,
          description: rule.description,
          criteria: rule.criteria as any,
        },
      });
    }

    this.logger.log('Badges initialized');
  }

  /**
   * Refresh user badges (check all badge criteria)
   */
  async refreshUserBadges(userId: string): Promise<void> {
    const badges = await this.prisma.badges.findMany();

    for (const badge of badges) {
      const criteria = badge.criteria as any;
      const earned = await this.checkBadgeCriteria(userId, criteria);

      if (earned) {
        // Award badge if not already earned
        const existing = await this.prisma.user_badges.findUnique({
          where: {
            user_id_badge_id: {
              user_id: userId,
              badge_id: badge.id,
            },
          },
        });

        if (!existing) {
          await this.prisma.user_badges.create({
            data: {
              user_id: userId,
              badge_id: badge.id,
            },
          });

          // Create notification
          await this.prisma.notifications.create({
            data: {
              receiver_id: userId,
              type: 'BADGE_EARNED',
              title: '🏅 New Badge Earned',
              body: `You earned the "${badge.name}" badge!`,
              payload: { badgeId: badge.id, badgeCode: badge.code },
            },
          });

          this.logger.log(`Badge awarded: ${userId} - ${badge.code}`);
        }
      }
    }
  }

  /**
   * Check if user meets badge criteria
   */
  private async checkBadgeCriteria(userId: string, criteria: any): Promise<boolean> {
    switch (criteria.type) {
      case 'points':
        const user = await this.prisma.users.findUnique({
          where: { id: userId },
          select: { points: true },
        });
        return user ? user.points >= criteria.threshold : false;

      case 'donations':
        const donationCount = await this.prisma.transaction_impacts.count({
          where: {
            [criteria.role === 'owner' ? 'owner_id' : 'receiver_id']: userId,
            // Assuming donations are FREE items
          },
        });
        return donationCount >= criteria.threshold;

      case 'sales':
        const salesCount = await this.prisma.transaction_impacts.count({
          where: {
            owner_id: userId,
            // Assuming sales are paid items - need to join with items table
          },
        });
        return salesCount >= criteria.threshold;

      case 'food_saved':
        const foodSaved = await this.prisma.transaction_impacts.aggregate({
          where: {
            OR: [{ owner_id: userId }, { receiver_id: userId }],
          },
          _sum: { food_saved_kg: true },
        });
        return Number(foodSaved._sum.food_saved_kg || 0) >= criteria.threshold;

      case 'co2_saved':
        const co2Saved = await this.prisma.transaction_impacts.aggregate({
          where: {
            OR: [{ owner_id: userId }, { receiver_id: userId }],
          },
          _sum: { co2_saved_kg: true },
        });
        return Number(co2Saved._sum.co2_saved_kg || 0) >= criteria.threshold;

      default:
        return false;
    }
  }

  /**
   * Get user badge progress
   */
  async getUserBadgeProgress(userId: string): Promise<any[]> {
    const badges = await this.prisma.badges.findMany({
      include: {
        user_badges: {
          where: { user_id: userId },
        },
      },
    });

    const progress: any[] = [];

    for (const badge of badges) {
      const criteria = badge.criteria as any;
      const isEarned = badge.user_badges.length > 0;
      let currentValue = 0;

      if (!isEarned) {
        // Calculate current progress
        switch (criteria.type) {
          case 'points':
            const user = await this.prisma.users.findUnique({
              where: { id: userId },
              select: { points: true },
            });
            currentValue = user?.points || 0;
            break;

          case 'food_saved':
            const foodSaved = await this.prisma.transaction_impacts.aggregate({
              where: {
                OR: [{ owner_id: userId }, { receiver_id: userId }],
              },
              _sum: { food_saved_kg: true },
            });
            currentValue = Number(foodSaved._sum.food_saved_kg || 0);
            break;

          case 'co2_saved':
            const co2Saved = await this.prisma.transaction_impacts.aggregate({
              where: {
                OR: [{ owner_id: userId }, { receiver_id: userId }],
              },
              _sum: { co2_saved_kg: true },
            });
            currentValue = Number(co2Saved._sum.co2_saved_kg || 0);
            break;

          // Add other criteria types as needed
        }
      }

      progress.push({
        badge: {
          id: badge.id,
          code: badge.code,
          name: badge.name,
          description: badge.description,
        },
        isEarned,
        currentValue: isEarned ? criteria.threshold : currentValue,
        targetValue: criteria.threshold,
        progressPercentage: isEarned ? 100 : Math.min(100, (currentValue / criteria.threshold) * 100),
        earnedAt: badge.user_badges[0]?.earned_at || null,
      });
    }

    return progress;
  }

  /**
   * Get user gamification stats
   */
  async getUserGamificationStats(userId: string): Promise<any> {
    // Get user points and badges separately to avoid Prisma conflict
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { points: true },
    });

    const userBadges = await this.prisma.user_badges.findMany({
      where: { user_id: userId },
      include: { badges: true },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Get transaction counts
    const completedTransactions = await this.prisma.transaction_impacts.findMany({
      where: {
        OR: [{ owner_id: userId }, { receiver_id: userId }],
      },
    });

    const donationsGiven = completedTransactions.filter(t => t.owner_id === userId).length;
    const itemsReceived = completedTransactions.filter(t => t.receiver_id === userId).length;

    // Get user rank
    const userRank = await this.getUserRank(userId);

    return {
      points: user.points,
      badges: userBadges.map(ub => ({
        ...ub.badges,
        earnedAt: ub.earned_at,
      })),
      completedDonations: donationsGiven,
      completedReceived: itemsReceived,
      completedSales: 0, // TODO: Calculate based on price_type
      completedPurchases: 0, // TODO: Calculate based on price_type
      rank: userRank,
    };
  }

  /**
   * Get user rank in leaderboard
   */
  private async getUserRank(userId: string): Promise<number> {
    const usersAbove = await this.prisma.users.count({
      where: {
        points: {
          gt: (await this.prisma.users.findUnique({
            where: { id: userId },
            select: { points: true },
          }))?.points || 0,
        },
        is_suspended: false,
      },
    });

    return usersAbove + 1;
  }

  /**
   * Get user's points history
   */
  async getUserPointsHistory(userId: string, limit = 20): Promise<any[]> {
    return this.prisma.points_ledger.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        delta: true,
        balance_after: true,
        action_code: true,
        created_at: true,
      },
    });
  }

  /**
   * Get points earned today
   */
  async pointsToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPoints = await this.prisma.points_ledger.aggregate({
      where: {
        user_id: userId,
        created_at: { gte: today },
      },
      _sum: { delta: true },
    });

    return todayPoints._sum.delta || 0;
  }

  /**
   * Get points history (alias for getUserPointsHistory)
   */
  async pointsHistory(userId: string, limit = 20): Promise<any[]> {
    return this.getUserPointsHistory(userId, limit);
  }

  /**
   * Award points for listing creation (legacy method)
   */
  async awardGiveListing(ownerId: string, itemId: string): Promise<void> {
    await this.awardPoints(ownerId, 5, 'ITEM_LISTED', itemId);
  }

  /**
   * Award points for completed transaction (legacy method)
   */
  async awardForCompletedTransaction(transaction: any): Promise<void> {
    await this.awardTransactionPoints(transaction.id);
  }

  /**
   * Award points for donation confirmation (legacy method)
   */
  async awardConfirmDonation(ownerId: string, transactionId: string): Promise<void> {
    await this.awardPoints(ownerId, 10, 'DONATION_CONFIRMED', transactionId);
  }

  /**
   * Estimate CO2 impact (legacy method)
   */
  estimateCo2Kg(qty: number): number {
    // Simple estimation: 2.5kg CO2 per unit
    return qty * 2.5;
  }
}