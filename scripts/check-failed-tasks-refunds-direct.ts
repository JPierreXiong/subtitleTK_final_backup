/**
 * Check failed tasks and verify if credits were refunded
 * Direct database query version (no auth required)
 */

import { db } from '../src/core/db';
import { mediaTasks, credit, user } from '../src/config/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

async function checkFailedTasksRefunds() {
  try {
    console.log('Checking failed tasks and credit refunds...\n');

    // Get user ID from command line argument or query all users
    const userIdArg = process.argv[2];
    
    if (!userIdArg) {
      console.log('Usage: npx tsx scripts/check-failed-tasks-refunds-direct.ts <userId>');
      console.log('\nOr query all users:');
      
      // List all users
      const allUsers = await db()
        .select({ id: user.id, email: user.email })
        .from(user)
        .limit(10);
      
      console.log('\nAvailable users:');
      allUsers.forEach((u: { id: string; email: string }, index: number) => {
        console.log(`  ${index + 1}. ${u.email} (${u.id})`);
      });
      
      process.exit(1);
    }

    const userId = userIdArg;
    console.log(`Checking for User ID: ${userId}\n`);

    // Get user info
    const [userInfo] = await db()
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userInfo) {
      console.log('✗ User not found');
      process.exit(1);
    }

    console.log(`User Email: ${userInfo.email}\n`);

    // Get all failed tasks for this user
    const failedTasks = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.userId, userId),
          eq(mediaTasks.status, 'failed')
        )
      )
      .orderBy(desc(mediaTasks.createdAt));

    console.log(`Failed tasks: ${failedTasks.length}\n`);

    if (failedTasks.length > 0) {
      console.log('Failed Tasks Details:');
      for (const task of failedTasks) {
        console.log(`\nTask ID: ${task.id}`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Output Type: ${task.outputType || 'N/A'}`);
        console.log(`  Credit ID: ${task.creditId || 'NONE (No refund possible)'}`);
        console.log(`  Is Free Trial: ${task.isFreeTrial || false}`);
        console.log(`  Error: ${task.errorMessage || 'N/A'}`);
        console.log(`  Created: ${task.createdAt}`);

        // Check if credit was refunded
        if (task.creditId) {
          const [creditRecord] = await db()
            .select()
            .from(credit)
            .where(eq(credit.id, task.creditId))
            .limit(1);

          if (creditRecord) {
            console.log(`  Credit Status: ${creditRecord.status}`);
            console.log(`  Credit Description: ${creditRecord.description}`);
            if (creditRecord.status === 'deleted') {
              console.log(`  ✓ Credit was refunded (status: deleted)`);
            } else {
              console.log(`  ✗ Credit NOT refunded (status: ${creditRecord.status})`);
            }
          } else {
            console.log(`  ✗ Credit record not found`);
          }
        }
      }
    }

    // Get recent credit transactions
    console.log('\n\nRecent Credit Transactions (last 20):');
    const recentCredits = await db()
      .select()
      .from(credit)
      .where(eq(credit.userId, userId))
      .orderBy(desc(credit.createdAt))
      .limit(20);

    if (recentCredits.length > 0) {
      recentCredits.forEach((creditRecord: typeof credit.$inferSelect, index: number) => {
        const isRefunded = creditRecord.status === 'deleted';
        const sign = creditRecord.transactionType === 'grant' ? '+' : '-';
        const credits = creditRecord.transactionType === 'consume' 
          ? (() => {
              try {
                const consumedItems = JSON.parse(creditRecord.consumedDetail || '[]');
                return consumedItems.reduce((sum: number, item: any) => sum + (item.creditsConsumed || 0), 0);
              } catch {
                return Math.abs(creditRecord.credits);
              }
            })()
          : Math.abs(creditRecord.credits);
        
        console.log(
          `\n${index + 1}. ${sign}${credits} credits - ${creditRecord.description}`
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
          eq(credit.userId, userId),
          eq(credit.transactionType, 'consume'),
          eq(credit.status, 'active')
        )
      );

    const totalConsumed = consumedCredits.reduce((sum: number, c: typeof credit.$inferSelect) => {
      try {
        const consumedItems = JSON.parse(c.consumedDetail || '[]');
        return (
          sum +
          consumedItems.reduce((itemSum: number, item: any) => {
            return itemSum + (item.creditsConsumed || 0);
          }, 0)
        );
      } catch {
        return sum + Math.abs(c.credits);
      }
    }, 0);

    console.log(`\n\nTotal Consumed Credits (not refunded): ${totalConsumed}`);

    // Get remaining credits
    const { getRemainingCredits } = await import('../src/shared/models/credit');
    const remaining = await getRemainingCredits(userId);
    console.log(`Remaining Credits: ${remaining}`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkFailedTasksRefunds();

