/**
 * Refund credits for failed tasks that were not refunded
 * This script checks all failed tasks and refunds credits if they weren't refunded
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { CreditStatus } from '../src/shared/models/credit';
import { getUserInfo } from '../src/shared/models/user';

async function refundFailedTasks() {
  try {
    console.log('Checking and refunding credits for failed tasks...\n');

    // Get current user
    const currentUser = await getUserInfo();
    if (!currentUser) {
      console.log('✗ No user logged in');
      process.exit(1);
    }

    console.log(`User ID: ${currentUser.id}`);
    console.log(`User Email: ${currentUser.email}\n`);

    // Get all failed tasks with creditId
    const failedTasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, currentUser.id),
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

    // Get updated remaining credits
    const { getRemainingCredits } = await import('../src/shared/models/credit');
    const remaining = await getRemainingCredits(currentUser.id);
    console.log(`\nRemaining Credits: ${remaining}`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

refundFailedTasks();

