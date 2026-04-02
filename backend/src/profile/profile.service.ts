import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapUser } from '../users/mappers/user.mapper';
import { BadgeModel } from './models/badge.model';
import {
  NotificationPreferencesModel,
  PrivacySettingsModel,
  ProfileModel,
} from './models/profile.model';
import { CO2_PER_KG_FOOD, KG_FOOD_PER_UNIT } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  TransactionKind,
  TransactionModel,
  TransactionRole,
} from './models/transaction.model';

type NotificationPrefs = {
  reservationCreated: boolean;
  reservationCanceled: boolean;
  badgeEarned: boolean;
};

type PrivacySettings = {
  showEmail: boolean;
  showPhone: boolean;
  showHistory: boolean;
  showBadges: boolean;
};

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  reservationCreated: true,
  reservationCanceled: true,
  badgeEarned: true,
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showEmail: false,
  showPhone: false,
  showHistory: true,
  showBadges: true,
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getProfile(
    userId: string,
    viewerId: string = userId,
  ): Promise<ProfileModel> {
    console.log(`[ProfileService] === GET PROFILE START ===`);
    console.log(`[ProfileService] userId demandé: ${userId}`);
    console.log(`[ProfileService] viewerId: ${viewerId}`);

    // Explicit select avoids runtime failures if DB schema isn't updated yet.
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        display_name: true,
        phone: true,
        role: true,
        points: true,
        trust_score: true,
        is_suspended: true,
        created_at: true,
        updated_at: true,
      } as any,
    });

    console.log(`[ProfileService] ✅ Utilisateur trouvé en base:`);
    console.log(`[ProfileService] - id: ${user?.id}`);
    console.log(`[ProfileService] - email: ${user?.email}`);
    console.log(`[ProfileService] - points: ${user?.points}`);
    console.log(`[ProfileService] - trust_score: ${user?.trust_score}`);

    if (!user) {
      console.log(`[ProfileService] ❌ User not found pour userId: ${userId}`);
      throw new Error('User not found');
    }

    // Charger les préférences depuis user_preferences
    const userPrefs = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    console.log(`[ProfileService] User preferences:`, userPrefs);

    // Mapper vers les modèles GraphQL
    const notificationPreferences: NotificationPrefs = {
      reservationCreated: userPrefs?.notif_reservation_updates ?? true,
      reservationCanceled: userPrefs?.notif_reservation_updates ?? true,
      badgeEarned: userPrefs?.notif_badges ?? true,
    };

    const privacySettings: PrivacySettings = {
      showEmail: false, // Pas de champ direct dans user_preferences
      showPhone: userPrefs?.show_phone ?? false,
      showHistory: userPrefs?.show_history ?? true,
      showBadges: userPrefs?.show_badges ?? true,
    };

    const isOwnerView = viewerId === userId;
    console.log(`[ProfileService] - isOwnerView: ${isOwnerView}`);

    const [history, badges] = await Promise.all([
      (isOwnerView || privacySettings.showHistory) ? this.getHistory(userId) : Promise.resolve([]),
      (isOwnerView || privacySettings.showBadges) ? this.getBadges(userId) : Promise.resolve([]),
    ]);

    console.log(`[ProfileService] ✅ Données récupérées:`);
    console.log(`[ProfileService] - history length: ${history.length}`);
    console.log(`[ProfileService] - badges length: ${badges.length}`);

    // Apply privacy masking only when someone else is viewing this profile.
    // The connected user should always see their own email/phone on `myProfile`.
    const userModel = mapUser(user);
    if (viewerId !== userId) {
      if (!privacySettings.showEmail) userModel.email = 'Hidden';
      if (!privacySettings.showPhone) userModel.phone = undefined;
    }

    const finalProfile = {
      user: userModel,
      history,
      badges,
      notificationPreferences:
        notificationPreferences as NotificationPreferencesModel,
      privacySettings: privacySettings as PrivacySettingsModel,
    };

    console.log(`[ProfileService] ✅ PROFIL FINAL CONSTRUIT:`);
    console.log(`[ProfileService] - user.id: ${finalProfile.user?.id}`);
    console.log(`[ProfileService] - user.points: ${finalProfile.user?.points}`);
    console.log(`[ProfileService] - user.trustScore: ${finalProfile.user?.trustScore}`);
    console.log(`[ProfileService] - badges: ${finalProfile.badges.length}`);
    console.log(`[ProfileService] - history: ${finalProfile.history.length}`);

    return finalProfile;
  }

  async updateNotificationPreferences(
    userId: string,
    input: Partial<NotificationPrefs>,
  ): Promise<NotificationPreferencesModel> {
    console.log(`[ProfileService] === UPDATE NOTIFICATION PREFS ===`);
    console.log(`[ProfileService] userId: ${userId}`);
    console.log(`[ProfileService] input:`, input);

    // Utiliser user_preferences au lieu de colonnes dans users
    const current = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    console.log(`[ProfileService] Current preferences:`, current);

    const data: any = {};
    if (input.reservationCreated !== undefined) {
      data.notif_reservation_updates = input.reservationCreated;
    }
    if (input.reservationCanceled !== undefined) {
      data.notif_reservation_updates = input.reservationCanceled;
    }
    if (input.badgeEarned !== undefined) {
      data.notif_badges = input.badgeEarned;
    }

    if (current) {
      // Update existing
      await this.prisma.user_preferences.update({
        where: { user_id: userId },
        data,
      });
    } else {
      // Create new with defaults
      await this.prisma.user_preferences.create({
        data: {
          user_id: userId,
          ...data,
        },
      });
    }

    // Return normalized response
    const updated = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    console.log(`[ProfileService] ✅ Preferences updated:`, updated);

    return {
      reservationCreated: updated?.notif_reservation_updates ?? true,
      reservationCanceled: updated?.notif_reservation_updates ?? true,
      badgeEarned: updated?.notif_badges ?? true,
    } as NotificationPreferencesModel;
  }

  async updatePrivacySettings(
    userId: string,
    input: Partial<PrivacySettings>,
  ): Promise<PrivacySettingsModel> {
    console.log(`[ProfileService] === UPDATE PRIVACY SETTINGS ===`);
    console.log(`[ProfileService] userId: ${userId}`);
    console.log(`[ProfileService] input:`, input);

    // Utiliser user_preferences au lieu de colonnes dans users
    const current = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    console.log(`[ProfileService] Current preferences:`, current);

    const data: any = {};
    if (input.showEmail !== undefined) {
      // Note: user_preferences n'a pas de champ show_email, on utilise profile_visibility
      // Pour l'instant on ignore ce champ ou on peut l'ajouter plus tard
    }
    if (input.showPhone !== undefined) {
      data.show_phone = input.showPhone;
    }
    if (input.showHistory !== undefined) {
      data.show_history = input.showHistory;
    }
    if (input.showBadges !== undefined) {
      data.show_badges = input.showBadges;
    }

    if (current) {
      // Update existing
      await this.prisma.user_preferences.update({
        where: { user_id: userId },
        data,
      });
    } else {
      // Create new with defaults
      await this.prisma.user_preferences.create({
        data: {
          user_id: userId,
          ...data,
        },
      });
    }

    // Return normalized response
    const updated = await this.prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    console.log(`[ProfileService] ✅ Privacy settings updated:`, updated);

    return {
      showEmail: false, // Pas de champ correspondant dans user_preferences pour l'instant
      showPhone: updated?.show_phone ?? false,
      showHistory: updated?.show_history ?? true,
      showBadges: updated?.show_badges ?? true,
    } as PrivacySettingsModel;
  }

  async getHistory(userId: string): Promise<TransactionModel[]> {
    console.log(`[ProfileService] Getting history for user_id: ${userId}`);
    
    const txs = await this.prisma.transactions.findMany({
      where: { OR: [{ owner_id: userId }, { receiver_id: userId }] } as any,
      include: { items: true } as any,
      orderBy: { created_at: 'desc' } as any,
      take: 50,
    });

    console.log(`[ProfileService] Found ${txs.length} transactions for user_id: ${userId}`);

    return txs.map((t: any) => {
      const role =
        t.owner_id === userId
          ? TransactionRole.OWNER
          : TransactionRole.RECEIVER;
      const priceType = t.items?.price_type ?? 'FREE';
      const kind =
        priceType === 'FREE'
          ? TransactionKind.DONATION
          : TransactionKind.PURCHASE;
      return {
        id: t.id,
        role,
        kind,
        status: String(t.status),
        quantity: t.quantity,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        item: {
          id: t.items?.id,
          title: t.items?.title ?? 'Item',
          type: String(t.items?.type ?? ''),
          priceType: String(priceType),
          priceAmount: t.items?.price_amount
            ? Number(t.items.price_amount)
            : undefined,
          currency: t.items?.currency ?? 'TND',
        },
      };
    });
  }

  async getBadges(userId: string): Promise<BadgeModel[]> {
    console.log(`[ProfileService] Getting badges for user_id: ${userId}`);
    
    const rows = await this.prisma.user_badges.findMany({
      where: { user_id: userId } as any,
      include: { badges: true } as any,
      orderBy: { earned_at: 'desc' } as any,
    });

    console.log(`[ProfileService] Found ${rows.length} badges for user_id: ${userId}`);

    return rows.map((r: any) => ({
      id: r.badges.id,
      code: r.badges.code,
      name: r.badges.name,
      description: r.badges.description,
      earnedAt: r.earned_at,
    }));
  }

  /**
   * Auto-award badges based on `badges.criteria` JSON.
   * Types: COMPLETED_TRANSACTIONS_TOTAL, COMPLETED_DONATIONS_AS_OWNER,
   * COMPLETED_SALES_AS_OWNER, POINTS_TOTAL, CO2_KG_AVOIDED_TOTAL, DISTRICT_FOOD_KG
   */
  async ensureBadgesForUser(userId: string): Promise<void> {
    const [allBadges, existing] = await Promise.all([
      this.prisma.badges.findMany(),
      this.prisma.user_badges.findMany({
        where: { user_id: userId } as any,
        select: { badge_id: true } as any,
      }),
    ]);

    if (allBadges.length === 0) return;

    const existingIds = new Set(existing.map((e: any) => e.badge_id));

    const completedTxs = await this.prisma.transactions.findMany({
      where: {
        OR: [{ owner_id: userId }, { receiver_id: userId }],
        status: 'COMPLETED',
      } as any,
      include: { items: true } as any,
    });

    const completedTotal = completedTxs.length;
    const completedDonationsAsOwner = completedTxs.filter(
      (t: any) =>
        t.owner_id === userId && (t.items?.price_type ?? 'FREE') === 'FREE',
    ).length;
    const completedSalesAsOwner = completedTxs.filter(
      (t: any) =>
        t.owner_id === userId && (t.items?.price_type ?? 'FREE') !== 'FREE',
    ).length;

    const dbUser = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    const pointsTotal = dbUser?.points ?? 0;

    const prof = await this.prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });
    const city = (prof?.city ?? '').trim().toLowerCase();

    let co2KgTotal = 0;
    let districtFoodKg = 0;
    for (const t of completedTxs as any[]) {
      const qty = t.quantity ?? 0;
      const kg = qty * KG_FOOD_PER_UNIT;
      const co2 = kg * CO2_PER_KG_FOOD;
      co2KgTotal += co2;
      const addr = String(t.items?.address ?? '').toLowerCase();
      if (
        city &&
        String(t.items?.type ?? '') === 'FOOD' &&
        addr.includes(city)
      ) {
        districtFoodKg += kg;
      }
    }

    const newlyEarnedBadgeIds: string[] = [];

    for (const b of allBadges as any[]) {
      const criteria = b.criteria;
      const type = criteria?.type;
      const min = Number(criteria?.min ?? 0);
      if (!type || !Number.isFinite(min) || min <= 0) continue;

      let eligible = false;
      if (type === 'COMPLETED_TRANSACTIONS_TOTAL')
        eligible = completedTotal >= min;
      if (type === 'COMPLETED_DONATIONS_AS_OWNER')
        eligible = completedDonationsAsOwner >= min;
      if (type === 'COMPLETED_SALES_AS_OWNER')
        eligible = completedSalesAsOwner >= min;
      if (type === 'POINTS_TOTAL') eligible = pointsTotal >= min;
      if (type === 'CO2_KG_AVOIDED_TOTAL') eligible = co2KgTotal >= min;
      if (type === 'DISTRICT_FOOD_KG') eligible = districtFoodKg >= min;

      if (eligible && !existingIds.has(b.id)) newlyEarnedBadgeIds.push(b.id);
    }

    if (newlyEarnedBadgeIds.length === 0) return;

    await this.prisma.user_badges.createMany({
      data: newlyEarnedBadgeIds.map(
        (badgeId) => ({ user_id: userId, badge_id: badgeId }) as any,
      ),
      skipDuplicates: true,
    } as any);

    await this.prisma.events.createMany({
      data: newlyEarnedBadgeIds.map(
        (badgeId) =>
          ({
            user_id: userId,
            type: 'BADGE_EARNED',
            meta: { badgeId },
          }) as any,
      ),
    } as any);

    const infos = await this.prisma.badges.findMany({
      where: { id: { in: newlyEarnedBadgeIds } },
    });
    for (const b of infos as any[]) {
      await this.notifications.notifyBadgeEarned(
        userId,
        b.name,
        b.code,
      );
    }
  }

  /**
   * Progression vers chaque badge (0–100 %), badges déjà obtenus à 100 %.
   */
  async getBadgeProgress(userId: string): Promise<
    Array<{
      code: string;
      name: string;
      description: string | null;
      progressPercent: number;
      unlocked: boolean;
      earnedAt: Date | null;
    }>
  > {
    const [allBadges, existingRows, metrics] = await Promise.all([
      this.prisma.badges.findMany(),
      this.prisma.user_badges.findMany({
        where: { user_id: userId } as any,
        include: { badges: true } as any,
      }),
      this.computeBadgeMetrics(userId),
    ]);

    const earnedMap = new Map(
      existingRows.map((r: any) => [r.badge_id, r.earned_at]),
    );

    return (allBadges as any[]).map((b) => {
      const criteria = b.criteria;
      const type = criteria?.type;
      const min = Number(criteria?.min ?? 0);
      let current = 0;
      if (type === 'COMPLETED_TRANSACTIONS_TOTAL')
        current = metrics.completedTotal;
      else if (type === 'COMPLETED_DONATIONS_AS_OWNER')
        current = metrics.completedDonationsAsOwner;
      else if (type === 'COMPLETED_SALES_AS_OWNER')
        current = metrics.completedSalesAsOwner;
      else if (type === 'POINTS_TOTAL') current = metrics.pointsTotal;
      else if (type === 'CO2_KG_AVOIDED_TOTAL') current = metrics.co2KgTotal;
      else if (type === 'DISTRICT_FOOD_KG') current = metrics.districtFoodKg;

      const earnedAt = earnedMap.get(b.id) ?? null;
      const unlocked = !!earnedAt;
      const progressPercent = unlocked
        ? 100
        : min > 0
          ? Math.min(100, Math.round((current / min) * 100))
          : 0;

      return {
        code: b.code,
        name: b.name,
        description: b.description,
        progressPercent,
        unlocked,
        earnedAt,
      };
    });
  }

  private async computeBadgeMetrics(userId: string) {
    const completedTxs = await this.prisma.transactions.findMany({
      where: {
        OR: [{ owner_id: userId }, { receiver_id: userId }],
        status: 'COMPLETED',
      } as any,
      include: { items: true } as any,
    });

    const completedTotal = completedTxs.length;
    const completedDonationsAsOwner = completedTxs.filter(
      (t: any) =>
        t.owner_id === userId && (t.items?.price_type ?? 'FREE') === 'FREE',
    ).length;
    const completedSalesAsOwner = completedTxs.filter(
      (t: any) =>
        t.owner_id === userId && (t.items?.price_type ?? 'FREE') !== 'FREE',
    ).length;

    const dbUser = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    const pointsTotal = dbUser?.points ?? 0;

    const prof = await this.prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });
    const city = (prof?.city ?? '').trim().toLowerCase();

    let co2KgTotal = 0;
    let districtFoodKg = 0;
    for (const t of completedTxs as any[]) {
      const qty = t.quantity ?? 0;
      const kg = qty * KG_FOOD_PER_UNIT;
      const co2 = kg * CO2_PER_KG_FOOD;
      co2KgTotal += co2;
      const addr = String(t.items?.address ?? '').toLowerCase();
      if (
        city &&
        String(t.items?.type ?? '') === 'FOOD' &&
        addr.includes(city)
      ) {
        districtFoodKg += kg;
      }
    }

    return {
      completedTotal,
      completedDonationsAsOwner,
      completedSalesAsOwner,
      pointsTotal,
      co2KgTotal,
      districtFoodKg,
    };
  }
}
