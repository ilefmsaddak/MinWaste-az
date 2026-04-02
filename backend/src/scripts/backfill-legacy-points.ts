import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillLegacyPoints() {
  console.log('🔄 Starting legacy points backfill...\n');
  console.log('This script creates ledger entries for existing points without changing balances.\n');

  try {
    // Find users with points but no ledger entries
    const usersWithPoints = await prisma.users.findMany({
      where: { points: { gt: 0 } },
    });

    console.log(`Found ${usersWithPoints.length} users with points\n`);

    let backfilled = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersWithPoints) {
      try {
        const existingLedger = await prisma.points_ledger.findFirst({
          where: { user_id: user.id },
        });

        if (existingLedger) {
          console.log(`⏭️  User ${user.id}: Already has ${await prisma.points_ledger.count({ where: { user_id: user.id } })} ledger entries, skipping`);
          skipped++;
          continue;
        }

        // Create backfill entry
        const idempotencyKey = `LEGACY_BACKFILL_${user.id}`;
        
        await prisma.points_ledger.create({
          data: {
            user_id: user.id,
            delta: user.points,
            balance_after: user.points,
            action_code: 'LEGACY_BACKFILL',
            ref_type: 'SYSTEM',
            ref_id: 'BACKFILL',
            idempotency_key: idempotencyKey,
          },
        });

        console.log(`✅ User ${user.id}: Backfilled ${user.points} points (idempotency_key: ${idempotencyKey})`);
        backfilled++;
      } catch (error) {
        console.error(`❌ User ${user.id}: Failed to backfill - ${error.message}`);
        errors++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('BACKFILL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Successfully backfilled: ${backfilled} users`);
    console.log(`⏭️  Skipped (already has ledger): ${skipped} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`${'='.repeat(60)}\n`);

    // Verify backfill
    console.log('🔍 Verifying backfill...\n');
    
    const verifyUsers = await prisma.users.findMany({
      where: { points: { gt: 0 } },
    });

    let verified = 0;
    let stillMismatched = 0;

    for (const user of verifyUsers) {
      const ledgerSum = await prisma.points_ledger.aggregate({
        where: { user_id: user.id },
        _sum: { delta: true },
      });

      const expectedTotal = ledgerSum._sum.delta || 0;

      if (user.points === expectedTotal) {
        console.log(`✅ User ${user.id}: ${user.points} points = ${expectedTotal} ledger sum`);
        verified++;
      } else {
        console.log(`❌ User ${user.id}: ${user.points} points ≠ ${expectedTotal} ledger sum`);
        stillMismatched++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('VERIFICATION RESULTS');
    console.log(`${'='.repeat(60)}`);
    console.log(`✅ Verified: ${verified} users`);
    console.log(`❌ Still mismatched: ${stillMismatched} users`);
    console.log(`${'='.repeat(60)}\n`);

    if (stillMismatched === 0) {
      console.log('🎉 All users verified! Backfill successful.\n');
    } else {
      console.log('⚠️  Some users still have mismatches. Please investigate.\n');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

backfillLegacyPoints();
