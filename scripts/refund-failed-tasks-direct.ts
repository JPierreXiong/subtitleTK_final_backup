/**
 * Refund credits for failed tasks that were not refunded
 * Direct database query version (no auth required)
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { CreditStatus } from '../src/shared/models/credit';

async function refundFailedTasks() {
  try {
    console.log('Checking and refunding credits for failed tasks...\n');

    // Get user ID from command line argument
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/refund-failed-tasks-direct.ts <userId>');
      process.exit(1);
    }

    const userId = userIdArg;
    console.log(`Processing for User ID: ${userId}\n`);

    // Get all failed tasks with creditId
    const failedTasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, userId),
          eq(mediaTasks.status, 'failed'),
          sql`${mediaTasks.creditId} IS NOT NULL`
        )
      )
      .orderBy(mediaTasks.createdAt);

    console.log(`Found ${failedTasks.length} failed tasks with creditId\n`);

    if (failedTasks.length === 0) {
      console.log('No failed tasks to refund.');
      process.exit(0);
    }

    let refundedCount = 0;
    let alreadyRefundedCount = 0;
    let errorCount = 0;
    let totalRefunded = 0;

    for (const task of failedTasks) {
      if (!task.creditId) continue;

      console.log(`\nProcessing Task: ${task.id}`);
      console.log(`  Output Type: ${task.outputType || 'N/A'}`);
      console.log(`  Credit ID: ${task.creditId}`);

      try {
        // Check credit record status
        const [creditRecord] = await db()
          .select()
          .from(credit)
          .where(eq(credit.id, task.creditId))
          .limit(1);

        if (!creditRecord) {
          console.log(`  ✗ Credit record not found`);
          errorCount++;
          continue;
        }

        if (creditRecord.status === CreditStatus.DELETED) {
          console.log(`  ✓ Already refunded`);
          alreadyRefundedCount++;
          continue;
        }

        if (creditRecord.status !== CreditStatus.ACTIVE) {
          console.log(`  ⚠ Credit record status is ${creditRecord.status}, skipping`);
          continue;
        }

        // Refund credits
        const consumedItems = JSON.parse(creditRecord.consumedDetail || '[]');
        console.log(`  Consumed items: ${consumedItems.length}`);

        let taskRefunded = 0;
        await db().transaction(async (tx: any) => {
          // Add back consumed credits
          for (const item of consumedItems) {
            if (item && item.creditId && item.creditsConsumed > 0) {
              await tx
                .update(credit)
                .set({
                  remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
                })
                .where(eq(credit.id, item.creditId));
              console.log(`    ✓ Refunded ${item.creditsConsumed} credits to credit ${item.creditId}`);
              taskRefunded += item.creditsConsumed;
            }
          }

          // Mark consumed credit record as deleted
          await tx
            .update(credit)
            .set({
              status: CreditStatus.DELETED,
            })
            .where(eq(credit.id, task.creditId));

          console.log(`  ✓ Marked credit record as deleted`);
        });

        refundedCount++;
        totalRefunded += taskRefunded;
      } catch (error: any) {
        console.error(`  ✗ Error refunding: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n\nSummary:`);
    console.log(`  Total failed tasks: ${failedTasks.length}`);
    console.log(`  Refunded: ${refundedCount}`);
    console.log(`  Already refunded: ${alreadyRefundedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total credits refunded: ${totalRefunded}`);

    // Get updated remaining credits
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

refundFailedTasks();

