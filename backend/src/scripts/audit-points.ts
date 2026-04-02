import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditResult {
  transactionId: string;
  ownerExpectedPoints: number;
  ownerActualPoints: number;
  receiverExpectedPoints: number;
  receiverActualPoints: number;
  ownerMatch: boolean;
  receiverMatch: boolean;
  isDonation: boolean;
  status: string;
  issues: string[];
}

async function auditPointsSystem() {
  console.log('🔍 Starting MinWaste Points Attribution Audit...\n');

  const results: AuditResult[] = [];
  const issues: string[] = [];

  try {
    // 1. Get all completed transactions
    console.log('📊 Fetching completed transactions...');
    const completedTransactions = await prisma.transactions.findMany({
      where: {
        status: { in: ['COMPLETED', 'CONFIRMED_BY_SENDER'] },
      },
      include: {
        items: {
          select: {
            price_type: true,
            title: true,
            category: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    console.log(`✓ Found ${completedTransactions.length} completed transactions\n`);

    // 2. For each transaction, verify points
    for (const tx of completedTransactions) {
      const isDonation = tx.items.price_type === 'FREE';
      const ownerExpected = isDonation ? 20 : 15;
      const receiverExpected = isDonation ? 10 : 15;

      // Get points ledger entries for this transaction
      const ownerLedger = await prisma.points_ledger.findMany({
        where: {
          user_id: tx.owner_id,
          ref_id: tx.id,
        },
      });

      const receiverLedger = await prisma.points_ledger.findMany({
        where: {
          user_id: tx.receiver_id,
          ref_id: tx.id,
        },
      });

      const ownerActual = ownerLedger.reduce((sum, entry) => sum + entry.delta, 0);
      const receiverActual = receiverLedger.reduce((sum, entry) => sum + entry.delta, 0);

      const ownerMatch = ownerActual === ownerExpected;
      const receiverMatch = receiverActual === receiverExpected;

      const txIssues: string[] = [];

      if (!ownerMatch) {
        txIssues.push(
          `Owner: expected ${ownerExpected} points, got ${ownerActual} (${ownerLedger.length} ledger entries)`
        );
      }

      if (!receiverMatch) {
        txIssues.push(
          `Receiver: expected ${receiverExpected} points, got ${receiverActual} (${receiverLedger.length} ledger entries)`
        );
      }

      if (ownerLedger.length > 1) {
        txIssues.push(`Owner has ${ownerLedger.length} ledger entries (possible duplicate)`);
      }

      if (receiverLedger.length > 1) {
        txIssues.push(`Receiver has ${receiverLedger.length} ledger entries (possible duplicate)`);
      }

      results.push({
        transactionId: tx.id,
        ownerExpectedPoints: ownerExpected,
        ownerActualPoints: ownerActual,
        receiverExpectedPoints: receiverExpected,
        receiverActualPoints: receiverActual,
        ownerMatch,
        receiverMatch,
        isDonation,
        status: tx.status,
        issues: txIssues,
      });

      if (txIssues.length > 0) {
        issues.push(`TX ${tx.id}: ${txIssues.join(' | ')}`);
      }
    }

    // 3. Check for pending/reserved transactions that shouldn't have points
    console.log('\n📋 Checking for incorrect point awards on non-completed transactions...');
    const invalidTransactions = await prisma.transactions.findMany({
      where: {
        status: { in: ['PENDING', 'CANCELED', 'EXPIRED'] },
      },
    });

    for (const tx of invalidTransactions) {
      const ownerLedger = await prisma.points_ledger.findMany({
        where: {
          user_id: tx.owner_id,
          ref_id: tx.id,
        },
      });

      const receiverLedger = await prisma.points_ledger.findMany({
        where: {
          user_id: tx.receiver_id,
          ref_id: tx.id,
        },
      });

      if (ownerLedger.length > 0 || receiverLedger.length > 0) {
        issues.push(
          `TX ${tx.id} (status: ${tx.status}): Has ${ownerLedger.length + receiverLedger.length} points awarded (should be 0)`
        );
      }
    }

    // 4. Verify user total points match ledger sum
    console.log('\n👤 Verifying user total points...');
    const users = await prisma.users.findMany({
      where: {
        points: { gt: 0 },
      },
    });

    for (const user of users) {
      const ledgerSum = await prisma.points_ledger.aggregate({
        where: { user_id: user.id },
        _sum: { delta: true },
      });

      const expectedTotal = ledgerSum._sum.delta || 0;

      if (user.points !== expectedTotal) {
        issues.push(
          `User ${user.id}: DB shows ${user.points} points, ledger sum is ${expectedTotal} (mismatch)`
        );
      }
    }

    // 5. Print results
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT RESULTS');
    console.log('='.repeat(80));

    const matchingTxs = results.filter(r => r.ownerMatch && r.receiverMatch);
    const mismatchedTxs = results.filter(r => !r.ownerMatch || !r.receiverMatch);

    console.log(`\n✅ Correct transactions: ${matchingTxs.length}/${results.length}`);
    console.log(`❌ Mismatched transactions: ${mismatchedTxs.length}/${results.length}`);

    if (mismatchedTxs.length > 0) {
      console.log('\n⚠️  MISMATCHED TRANSACTIONS:');
      mismatchedTxs.forEach(r => {
        console.log(`\n  TX: ${r.transactionId}`);
        console.log(`  Type: ${r.isDonation ? 'DONATION' : 'SALE'}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  Owner: expected ${r.ownerExpectedPoints}, got ${r.ownerActualPoints}`);
        console.log(`  Receiver: expected ${r.receiverExpectedPoints}, got ${r.receiverActualPoints}`);
        r.issues.forEach(issue => console.log(`    - ${issue}`));
      });
    }

    if (issues.length > 0) {
      console.log('\n\n🔴 CRITICAL ISSUES FOUND:');
      issues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue}`);
      });
    } else {
      console.log('\n\n✅ NO CRITICAL ISSUES FOUND');
    }

    // 6. Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY STATISTICS');
    console.log('='.repeat(80));

    const donationTxs = results.filter(r => r.isDonation);
    const saleTxs = results.filter(r => !r.isDonation);

    console.log(`\nDonation transactions: ${donationTxs.length}`);
    console.log(`  - Correct: ${donationTxs.filter(r => r.ownerMatch && r.receiverMatch).length}`);
    console.log(`  - Mismatched: ${donationTxs.filter(r => !r.ownerMatch || !r.receiverMatch).length}`);

    console.log(`\nSale transactions: ${saleTxs.length}`);
    console.log(`  - Correct: ${saleTxs.filter(r => r.ownerMatch && r.receiverMatch).length}`);
    console.log(`  - Mismatched: ${saleTxs.filter(r => !r.ownerMatch || !r.receiverMatch).length}`);

    console.log(`\nTotal points awarded: ${results.reduce((sum, r) => sum + r.ownerActualPoints + r.receiverActualPoints, 0)}`);
    console.log(`Total users with points: ${users.length}`);

    // 7. Export detailed results
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED RESULTS (JSON)');
    console.log('='.repeat(80));
    console.log(JSON.stringify(results, null, 2));

  } catch (error) {
    console.error('❌ Audit failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

auditPointsSystem();
