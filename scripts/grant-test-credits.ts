/**
 * Grant Test Credits to Users
 * 
 * This script grants 100 credits to specified users for testing purposes.
 * 
 * Usage:
 *   npx tsx scripts/grant-test-credits.ts
 */

import { eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';
import {
  createCredit,
  CreditStatus,
  CreditTransactionType,
  CreditTransactionScene,
} from '@/shared/models/credit';
import { getSnowId, getUuid } from '@/shared/lib/hash';

async function grantTestCredits() {
  console.log('🚀 Starting to grant test credits...\n');

  // Email addresses to grant credits to
  const testEmails = [
    'xiongjp_fr@163.com',
    'xiongjp_fr@hotmail.com',
  ];

  const creditsToGrant = 100;

  try {
    for (const email of testEmails) {
      console.log(`\n📧 Processing user: ${email}`);

      // Find user by email
      const [foundUser] = await db()
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (!foundUser) {
        console.log(`   ⚠️  User not found: ${email}`);
        continue;
      }

      console.log(`   ✓ User found: ${foundUser.id} (${foundUser.name || 'N/A'})`);

      // Create credit record
      const newCredit = {
        id: getUuid(),
        userId: foundUser.id,
        userEmail: foundUser.email || email,
        orderNo: null,
        subscriptionNo: null,
        transactionNo: getSnowId(),
        transactionType: CreditTransactionType.GRANT,
        transactionScene: CreditTransactionScene.GIFT,
        credits: creditsToGrant,
        remainingCredits: creditsToGrant,
        description: 'Test credits grant - 100 credits for testing',
        expiresAt: null, // Credits don't expire
        status: CreditStatus.ACTIVE,
      };

      await createCredit(newCredit);

      console.log(`   ✅ Successfully granted ${creditsToGrant} credits to ${email}`);
      console.log(`   📝 Transaction No: ${newCredit.transactionNo}`);
    }

    console.log('\n✨ All credits granted successfully!');
  } catch (error: any) {
    console.error('\n❌ Error granting credits:', error);
    console.error('Error message:', error.message);
    process.exit(1);
  }
}

// Run the script
grantTestCredits()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

