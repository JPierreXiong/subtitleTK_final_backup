/**
 * Analyze credit consumption in detail
 */

import { db } from '../src/core/db';
import { credit } from '../src/config/db/schema';
import { eq, and, desc } from 'drizzle-orm';

async function analyzeCreditConsumption() {
  try {
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/analyze-credit-consumption.ts <userId>');
      process.exit(1);
    }

    const userId = userIdArg;
    console.log(`Analyzing credit consumption for User ID: ${userId}\n`);

    // Get all consume transactions
    const consumeTransactions = await db()
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.userId, userId),
          eq(credit.transactionType, 'consume')
        )
      )
      .orderBy(desc(credit.createdAt));

    console.log(`Total consume transactions: ${consumeTransactions.length}\n`);

    let totalConsumed = 0;
    let totalRefunded = 0;
    let activeConsumed = 0;

    console.log('=== Consume Transactions ===\n');
    
    for (const trans of consumeTransactions) {
      const consumedItems = JSON.parse(trans.consumedDetail || '[]');
      const credits = consumedItems.reduce((sum: number, item: any) => sum + (item.creditsConsumed || 0), 0);
      
      const statusIcon = trans.status === 'deleted' ? '✓' : '✗';
      const statusText = trans.status === 'deleted' ? 'REFUNDED' : 'ACTIVE';
      
      console.log(`${statusIcon} ${trans.description}`);
      console.log(`   Transaction No: ${trans.transactionNo}`);
      console.log(`   Credits: -${credits}`);
      console.log(`   Status: ${trans.status} (${statusText})`);
      console.log(`   Created: ${trans.createdAt}`);
      
      if (trans.metadata) {
        try {
          const metadata = JSON.parse(trans.metadata);
          if (metadata.taskId) {
            console.log(`   Task ID: ${metadata.taskId}`);
          }
          if (metadata.type) {
            console.log(`   Type: ${metadata.type}`);
          }
        } catch {}
      }
      
      console.log('');

      if (trans.status === 'deleted') {
        totalRefunded += credits;
      } else {
        totalConsumed += credits;
        activeConsumed += credits;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total consumed: ${totalConsumed + totalRefunded} credits`);
    console.log(`Active (not refunded): ${activeConsumed} credits`);
    console.log(`Refunded: ${totalRefunded} credits`);
    console.log(`Net consumed: ${totalConsumed} credits`);

    // Get remaining credits
    const { getRemainingCredits } = await import('../src/shared/models/credit');
    const remaining = await getRemainingCredits(userId);
    console.log(`\nRemaining Credits: ${remaining}`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

analyzeCreditConsumption();

