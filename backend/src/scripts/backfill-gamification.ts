import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

/**
 * Backfill script to recalculate gamification and ecology metrics for all completed transactions
 * 
 * This script:
 * 1. Finds all completed transactions
 * 2. Calculates and awards points (if not already awarded)
 * 3. Calculates ecology impact (if not already calculated)
 * 4. Refreshes badges for all users
 * 
 * Safe to run multiple times (idempotent)
 */

async function backfillGamification() {
  console.log('Starting gamification backfill...');

  try {
    // Get all completed transactions
    const completedTxs = await prisma.transactions.findMany({
      where: {
        status: { in: ['COMPLETED', 'CONFIRMED_BY_SENDER'] },
      },
      include: { items: true },
    });

    console.log(`Found ${completedTxs.length} completed transactions`);

    let pointsAwarded = 0;
    let impactsCalculated = 0;
    let errors = 0;

    for (const tx of completedTxs) {
      try {
        // Award points if not already awarded
        const pointsResult = await awardTransactionPoints(tx);
        if (pointsResult) pointsAwarded++;

        // Calculate ecology impact if not already calculated
        const impactResult = await calculateTransactionImpact(tx);
        if (impactResult) impactsCalculated++;
      } catch (err) {
        console.error(`Error processing transaction ${tx.id}:`, err);
        errors++;
      }
    }

    console.log(`\nBackfill Results:`);
    console.log(`- Points awarded: ${pointsAwarded}`);
    console.log(`- Impacts calculated: ${impactsCalculated}`);
    console.log(`- Errors: ${errors}`);

    // Refresh badges for all users
    console.log('\nRefreshing badges for all users...');
    const allUsers = await prisma.users.findMany({
      select: { id: true },
    });

    let badgesRefreshed = 0;
    for (const user of allUsers) {
      try {
        await refreshUserBadges(user.id);
        badgesRefreshed++;
      } catch (err) {
        console.error(`Error refreshing badges for user ${user.id}:`, err);
      }
    }

    console.log(`- Badges refreshed for ${badgesRefreshed} users`);
    console.log('\nBackfill complete!');
  } catch (err) {
    console.error('Backfill failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Award points for a transaction (idempotent)
 */
async function awardTransactionPoints(tx: any): Promise<boolean> {
  const isDonation = tx.items?.price_type === 'FREE';

  // Determine points to award
  const ownerPoints = isDonation ? 20 : 15;
  const receiverPoints = isDonation ? 10 : 15;

  // Award to owner
  const ownerKey = `${isDonation ? 'DONATION_GIVEN' : 'SALE_COMPLETED'}_${tx.id}_${tx.owner_id}`;
  const ownerExists = await prisma.points_ledger.findUnique({
    where: { idempotency_key: ownerKey },
  });

  let awarded = false;

  if (!ownerExists) {
    const ownerUser = await prisma.users.findUnique({
      where: { id: tx.owner_id },
      select: { points: true },
    });

    if (ownerUser) {
      const newBalance = ownerUser.points + ownerPoints;
      await prisma.$transaction(async (txn) => {
        await txn.points_ledger.create({
          data: {
            user_id: tx.owner_id,
            delta: ownerPoints,
            balance_after: newBalance,
            action_code: isDonation ? 'DONATION_GIVEN' : 'SALE_COMPLETED',
            ref_type: 'TRANSACTION',
            ref_id: tx.id,
            idempotency_key: ownerKey,
          },
        });

        await txn.users.update({
          where: { id: tx.owner_id },
          data: { points: newBalance },
        });
      });
      awarded = true;
    }
  }

  // Award to receiver
  const receiverKey = `${isDonation ? 'DONATION_RECEIVED' : 'PURCHASE_COMPLETED'}_${tx.id}_${tx.receiver_id}`;
  const receiverExists = await prisma.points_ledger.findUnique({
    where: { idempotency_key: receiverKey },
  });

  if (!receiverExists) {
    const receiverUser = await prisma.users.findUnique({
      where: { id: tx.receiver_id },
      select: { points: true },
    });

    if (receiverUser) {
      const newBalance = receiverUser.points + receiverPoints;
      await prisma.$transaction(async (txn) => {
        await txn.points_ledger.create({
          data: {
            user_id: tx.receiver_id,
            delta: receiverPoints,
            balance_after: newBalance,
            action_code: isDonation ? 'DONATION_RECEIVED' : 'PURCHASE_COMPLETED',
            ref_type: 'TRANSACTION',
            ref_id: tx.id,
            idempotency_key: receiverKey,
          },
        });

        await txn.users.update({
          where: { id: tx.receiver_id },
          data: { points: newBalance },
        });
      });
      awarded = true;
    }
  }

  return awarded;
}

/**
 * Calculate ecology impact for a transaction (idempotent)
 */
async function calculateTransactionImpact(tx: any): Promise<boolean> {
  // Check if already calculated
  const existing = await prisma.transaction_impacts.findUnique({
    where: { transaction_id: tx.id },
  });

  if (existing) {
    return false;
  }

  // Get ecology factors for category
  const category = tx.items?.category || 'OTHER';
  const factors = await prisma.ecology_factors.findUnique({
    where: { category },
  });

  if (!factors) {
    console.warn(`No ecology factors found for category: ${category}`);
    return false;
  }

  // Calculate impact
  const quantity = tx.quantity || 1;
  const effectiveWeight = Number(factors.default_weight_kg) * quantity;
  const foodSaved = category === 'FOOD' ? effectiveWeight : 0;
  const co2Saved = effectiveWeight * Number(factors.co2_factor_kg_per_kg);
  const waterSaved = effectiveWeight * Number(factors.water_factor_l_per_kg);
  const energySaved = effectiveWeight * Number(factors.energy_factor_kwh_per_kg);
  const landfillDiversion = effectiveWeight;
  const treeEquivalent = co2Saved / 21;

  // Get receiver's neighborhood
  const receiverProfile = await prisma.user_profiles.findUnique({
    where: { user_id: tx.receiver_id },
  });

  // Create impact record
  await prisma.transaction_impacts.create({
    data: {
      transaction_id: tx.id,
      item_id: tx.item_id,
      owner_id: tx.owner_id,
      receiver_id: tx.receiver_id,
      category,
      quantity,
      effective_weight_kg: new Decimal(effectiveWeight),
      food_saved_kg: new Decimal(foodSaved),
      co2_saved_kg: new Decimal(co2Saved),
      water_saved_liters: new Decimal(waterSaved),
      energy_saved_kwh: new Decimal(energySaved),
      landfill_diversion_kg: new Decimal(landfillDiversion),
      tree_equivalent: new Decimal(treeEquivalent),
      neighborhood: receiverProfile?.city,
      completed_at: tx.updated_at,
    },
  });

  return true;
}

/**
 * Refresh badges for a user
 */
async function refreshUserBadges(userId: string): Promise<void> {
  const badges = await prisma.badges.findMany();

  for (const badge of badges) {
    const criteria = badge.criteria as any;
    const earned = await checkBadgeCriteria(userId, criteria);

    if (earned) {
      // Check if already earned
      const existing = await prisma.user_badges.findUnique({
        where: {
          user_id_badge_id: {
            user_id: userId,
            badge_id: badge.id,
          },
        },
      });

      if (!existing) {
        await prisma.user_badges.create({
          data: {
            user_id: userId,
            badge_id: badge.id,
          },
        });

        // Create notification
        await prisma.notifications.create({
          data: {
            receiver_id: userId,
            type: 'BADGE_EARNED',
            title: '🏅 New Badge Earned',
            body: `You earned the "${badge.name}" badge!`,
            payload: { badgeId: badge.id, badgeCode: badge.code },
          },
        });
      }
    }
  }
}

/**
 * Check if user meets badge criteria
 */
async function checkBadgeCriteria(userId: string, criteria: any): Promise<boolean> {
  switch (criteria.type) {
    case 'points': {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { points: true },
      });
      return user ? user.points >= criteria.threshold : false;
    }

    case 'donations': {
      const count = await prisma.transactions.count({
        where: {
          owner_id: userId,
          status: { in: ['COMPLETED', 'CONFIRMED_BY_SENDER'] },
          items: { price_type: 'FREE' },
        },
      });
      return count >= criteria.threshold;
    }

    case 'sales': {
      const count = await prisma.transactions.count({
        where: {
          owner_id: userId,
          status: { in: ['COMPLETED', 'CONFIRMED_BY_SENDER'] },
          items: { price_type: { not: 'FREE' } },
        },
      });
      return count >= criteria.threshold;
    }

    case 'food_saved': {
      const impacts = await prisma.transaction_impacts.aggregate({
        where: {
          OR: [{ owner_id: userId }, { receiver_id: userId }],
        },
        _sum: { food_saved_kg: true },
      });
      return Number(impacts._sum.food_saved_kg || 0) >= criteria.threshold;
    }

    case 'co2_saved': {
      const impacts = await prisma.transaction_impacts.aggregate({
        where: {
          OR: [{ owner_id: userId }, { receiver_id: userId }],
        },
        _sum: { co2_saved_kg: true },
      });
      return Number(impacts._sum.co2_saved_kg || 0) >= criteria.threshold;
    }

    default:
      return false;
  }
}

// Run backfill
backfillGamification().catch(console.error);
