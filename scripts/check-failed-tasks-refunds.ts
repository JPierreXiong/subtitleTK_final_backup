/**
 * Check failed tasks and verify if credits were refunded
 */

import { db } from '../src/core/db';
import { mediaTasks, credit } from '../src/config/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getUserInfo } from '../src/shared/models/user';

async function checkFailedTasksRefunds() {
  try {
    console.log('Checking failed tasks and credit refunds...\n');

    // Get current user
    const currentUser = await getUserInfo();
    if (!currentUser) {
      console.log('✗ No user logged in');
      process.exit(1);
    }

    console.log(`User ID: ${currentUser.id}`);
    console.log(`User Email: ${currentUser.email}\n`);

    // Get all failed tasks for this user
    const failedTasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, currentUser.id),
          eq(mediaTasks.status, 'failed')
        )
      )
      .orderBy(desc(mediaTasks.createdAt))
      .limit(20);

    console.log(`Failed tasks: ${failedTasks.length}\n`);

    if (failedTasks.length > 0) {
      console.log('Failed Tasks Details:');
      failedTasks.forEach((task: typeof mediaTasks.$inferSelect, index: number) => {
        console.log(`\n${index + 1}. Task ID: ${task.id}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Output Type: ${task.outputType || 'N/A'}`);
        console.log(`   Credit ID: ${task.creditId || 'NONE (No refund possible)'}`);
        console.log(`   Is Free Trial: ${task.isFreeTrial || false}`);
        console.log(`   Error: ${task.errorMessage || 'N/A'}`);
        console.log(`   Created: ${task.createdAt}`);

        // Check if credit was refunded
        if (task.creditId) {
          // Check credit record status
          db()
            .select()
            .from(credit)
            .where(eq(credit.id, task.creditId))
            .limit(1)
            .then((creditRecords: typeof credit.$inferSelect[]) => {
              if (creditRecords.length > 0) {
                const creditRecord = creditRecords[0];
                console.log(`   Credit Status: ${creditRecord.status}`);
                console.log(`   Credit Description: ${creditRecord.description}`);
                if (creditRecord.status === 'deleted') {
                  console.log(`   ✓ Credit was refunded (status: deleted)`);
                } else {
                  console.log(`   ✗ Credit NOT refunded (status: ${creditRecord.status})`);
                }
              } else {
                console.log(`   ✗ Credit record not found`);
              }
            })
            .catch((err: any) => {
              console.log(`   Error checking credit: ${err.message}`);
            });
        }
      });
    }

    // Get recent credit transactions
    console.log('\n\nRecent Credit Transactions (last 10):');
    const recentCredits = await db()
      .select()
      .from(credit)
      .where(eq(credit.userId, currentUser.id))
      .orderBy(desc(credit.createdAt))
      .limit(10);

    if (recentCredits.length > 0) {
      recentCredits.forEach((creditRecord: typeof credit.$inferSelect, index: number) => {
        const isRefunded = creditRecord.status === 'deleted';
        const sign = creditRecord.transactionType === 'grant' ? '+' : '-';
        console.log(
          `\n${index + 1}. ${sign}${Math.abs(creditRecord.credits)} credits - ${creditRecord.description}`
        );
        console.log(`   Status: ${creditRecord.status} ${isRefunded ? '(REFUNDED)' : ''}`);
        console.log(`   Created: ${creditRecord.createdAt}`);
        console.log(`   Transaction No: ${creditRecord.transactionNo}`);
      });
    }

    // Calculate total consumed credits (not refunded)
    const consumedCredits = await db()
      .select()
      .from(credit)
      .where(
        and(
          eq(credit.userId, currentUser.id),
          eq(credit.transactionType, 'consume'),
          eq(credit.status, 'active')
        )
      );

    const totalConsumed = consumedCredits.reduce((sum: number, c: typeof credit.$inferSelect) => {
      const consumedItems = JSON.parse(c.consumedDetail || '[]');
      return (
        sum +
        consumedItems.reduce((itemSum: number, item: any) => {
          return itemSum + (item.creditsConsumed || 0);
        }, 0)
      );
    }, 0);

    console.log(`\n\nTotal Consumed Credits (not refunded): ${totalConsumed}`);

    // Get remaining credits
    const { getRemainingCredits } = await import('../src/shared/models/credit');
    const remaining = await getRemainingCredits(currentUser.id);
    console.log(`Remaining Credits: ${remaining}`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkFailedTasksRefunds();

