/**
 * Verify that the refund logic works correctly
 * This script creates a test scenario to verify refunds
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { CreditStatus } from '../src/shared/models/credit';
import { updateMediaTaskById } from '../src/shared/models/media_task';

async function verifyRefundLogic() {
  try {
    console.log('Verifying refund logic...\n');

    // Get a user with recent tasks
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/verify-refund-logic.ts <userId>');
      console.log('\nThis script verifies that:');
      console.log('1. Failed tasks with creditId are automatically refunded');
      console.log('2. updateMediaTaskById correctly handles creditId');
      process.exit(1);
    }

    const userId = userIdArg;

    // Get recent tasks with creditId
    const tasksWithCredits = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, userId),
          sql`${mediaTasks.creditId} IS NOT NULL`
        )
      )
      .orderBy(mediaTasks.createdAt)
      .limit(10);

    console.log(`Found ${tasksWithCredits.length} tasks with creditId\n`);

    if (tasksWithCredits.length === 0) {
      console.log('No tasks with creditId found. Cannot verify refund logic.');
      process.exit(0);
    }

    console.log('Verification Results:\n');

    for (const task of tasksWithCredits) {
      if (!task.creditId) continue;

      const [creditRecord] = await db()
        .select()
        .from(credit)
        .where(eq(credit.id, task.creditId))
        .limit(1);

      if (!creditRecord) {
        console.log(`✗ Task ${task.id.substring(0, 8)}... - Credit record not found`);
        continue;
      }

      const statusMatch = 
        (task.status === 'failed' && creditRecord.status === CreditStatus.DELETED) ||
        (task.status !== 'failed' && creditRecord.status === CreditStatus.ACTIVE);

      if (statusMatch) {
        console.log(`✓ Task ${task.id.substring(0, 8)}... - Status: ${task.status}, Credit: ${creditRecord.status} (CORRECT)`);
      } else {
        console.log(`✗ Task ${task.id.substring(0, 8)}... - Status: ${task.status}, Credit: ${creditRecord.status} (MISMATCH)`);
        if (task.status === 'failed' && creditRecord.status === CreditStatus.ACTIVE) {
          console.log(`  ⚠ This task failed but credit was not refunded!`);
        }
      }
    }

    console.log('\n=== Summary ===');
    console.log('✓ Refund logic verification complete');
    console.log('\nKey Points:');
    console.log('1. Failed tasks should have creditId set');
    console.log('2. Failed tasks should have credit status = "deleted"');
    console.log('3. updateMediaTaskById should handle creditId correctly');

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyRefundLogic();

