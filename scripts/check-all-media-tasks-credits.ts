/**
 * Check all media tasks and their credit consumption
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, desc } from 'drizzle-orm';

async function checkAllMediaTasksCredits() {
  try {
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/check-all-media-tasks-credits.ts <userId>');
      process.exit(1);
    }

    const userId = userIdArg;
    console.log(`Checking all media tasks for User ID: ${userId}\n`);

    // Get all media tasks
    const allTasks = await db()
      .select()
      .from(mediaTasks)
      .where(eq(mediaTasks.userId, userId))
      .orderBy(desc(mediaTasks.createdAt))
      .limit(50);

    console.log(`Total media tasks: ${allTasks.length}\n`);

    let totalConsumed = 0;
    let totalRefunded = 0;
    let failedWithoutRefund = 0;

    for (const task of allTasks) {
      const statusIcon = task.status === 'failed' ? '✗' : task.status === 'completed' || task.status === 'extracted' ? '✓' : '○';
      console.log(`${statusIcon} Task: ${task.id.substring(0, 8)}...`);
      console.log(`   Status: ${task.status}`);
      console.log(`   Output Type: ${task.outputType || 'N/A'}`);
      console.log(`   Is Free Trial: ${task.isFreeTrial || false}`);
      console.log(`   Credit ID: ${task.creditId || 'NONE'}`);
      
      if (task.creditId) {
        const [creditRecord] = await db()
          .select()
          .from(credit)
          .where(eq(credit.id, task.creditId))
          .limit(1);

        if (creditRecord) {
          const consumedItems = JSON.parse(creditRecord.consumedDetail || '[]');
          const taskCredits = consumedItems.reduce((sum: number, item: any) => sum + (item.creditsConsumed || 0), 0);
          
          console.log(`   Credits: -${taskCredits}`);
          console.log(`   Credit Status: ${creditRecord.status}`);
          
          if (task.status === 'failed' && creditRecord.status === 'active') {
            console.log(`   ⚠ FAILED TASK WITHOUT REFUND!`);
            failedWithoutRefund++;
            totalConsumed += taskCredits;
          } else if (creditRecord.status === 'deleted') {
            console.log(`   ✓ Refunded`);
            totalRefunded += taskCredits;
          } else {
            totalConsumed += taskCredits;
          }
        }
      } else if (task.status === 'failed' && !task.isFreeTrial) {
        console.log(`   ⚠ FAILED TASK WITHOUT CREDIT ID (cannot refund)`);
        failedWithoutRefund++;
      }
      
      if (task.errorMessage) {
        console.log(`   Error: ${task.errorMessage}`);
      }
      console.log(`   Created: ${task.createdAt}`);
      console.log('');
    }

    console.log('\n=== Summary ===');
    console.log(`Total tasks: ${allTasks.length}`);
    console.log(`Failed tasks without refund: ${failedWithoutRefund}`);
    console.log(`Total consumed (not refunded): ${totalConsumed} credits`);
    console.log(`Total refunded: ${totalRefunded} credits`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkAllMediaTasksCredits();

