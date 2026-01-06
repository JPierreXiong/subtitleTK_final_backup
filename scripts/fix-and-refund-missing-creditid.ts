/**
 * Fix tasks without creditId and refund credits
 * This script matches credit transactions to tasks and refunds failed ones
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { CreditStatus } from '../src/shared/models/credit';

async function fixAndRefundMissingCreditId() {
  try {
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/fix-and-refund-missing-creditid.ts <userId>');
      process.exit(1);
    }

    const userId = userIdArg;
    console.log(`Fixing and refunding for User ID: ${userId}\n`);

    // Get all failed tasks without creditId
    const failedTasksWithoutCreditId = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, userId),
          eq(mediaTasks.status, 'failed'),
          sql`${mediaTasks.creditId} IS NULL`
        )
      )
      .orderBy(mediaTasks.createdAt);

    console.log(`Found ${failedTasksWithoutCreditId.length} failed tasks without creditId\n`);

    if (failedTasksWithoutCreditId.length === 0) {
      console.log('No tasks to fix.');
      process.exit(0);
    }

    // Get all consume credit transactions for this user
    const consumeCredits = await db()
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.userId, userId),
          eq(credit.transactionType, 'consume'),
          eq(credit.status, CreditStatus.ACTIVE)
        )
      )
      .orderBy(credit.createdAt);

    console.log(`Found ${consumeCredits.length} active consume transactions\n`);

    let fixedCount = 0;
    let refundedCount = 0;
    let totalRefunded = 0;

    // Match tasks to credit transactions by taskId in metadata
    for (const task of failedTasksWithoutCreditId) {
      console.log(`\nProcessing Task: ${task.id}`);
      console.log(`  Created: ${task.createdAt}`);

      // Find matching credit transaction by taskId in metadata
      const matchingCredit = consumeCredits.find((c: typeof credit.$inferSelect) => {
        try {
          const metadata = JSON.parse(c.metadata || '{}');
          return metadata.taskId === task.id && metadata.type === 'media-task';
        } catch {
          return false;
        }
      });

      if (matchingCredit) {
        console.log(`  Found matching credit: ${matchingCredit.id}`);
        console.log(`  Credits: ${matchingCredit.consumedDetail}`);

        const consumedItems = JSON.parse(matchingCredit.consumedDetail || '[]');
        const taskCredits = consumedItems.reduce((sum: number, item: any) => sum + (item.creditsConsumed || 0), 0);
        console.log(`  Total credits: ${taskCredits}`);

        try {
          await db().transaction(async (tx: any) => {
            // 1. Update task with creditId
            await tx
              .update(mediaTasks)
              .set({ creditId: matchingCredit.id })
              .where(eq(mediaTasks.id, task.id));
            console.log(`  ✓ Updated task with creditId`);

            // 2. Refund credits
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

            // 3. Mark consumed credit record as deleted
            await tx
              .update(credit)
              .set({
                status: CreditStatus.DELETED,
              })
              .where(eq(credit.id, matchingCredit.id));

            console.log(`  ✓ Marked credit record as deleted`);
          });

          fixedCount++;
          refundedCount++;
          totalRefunded += taskCredits;
        } catch (error: any) {
          console.error(`  ✗ Error: ${error.message}`);
        }
      } else {
        console.log(`  ⚠ No matching credit transaction found`);
      }
    }

    console.log(`\n\n=== Summary ===`);
    console.log(`Tasks processed: ${failedTasksWithoutCreditId.length}`);
    console.log(`Tasks fixed and refunded: ${refundedCount}`);
    console.log(`Total credits refunded: ${totalRefunded}`);

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

fixAndRefundMissingCreditId();

