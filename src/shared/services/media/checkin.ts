/**
 * Daily check-in service
 * Provides atomic check-in operations with credit rewards
 */

import { db } from '@/core/db';
import { dailyCheckins, user } from '@/config/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUuid } from '@/shared/lib/hash';
import { CreditTransactionScene } from '@/shared/models/credit';

const CHECKIN_REWARD_CREDITS = 2;

/**
 * Perform daily check-in for a user
 * Uses transaction to ensure atomicity (prevent duplicate check-ins)
 * 
 * @param userId User ID
 * @returns Check-in result with added credits
 */
export async function performDailyCheckin(userId: string) {
  // Get UTC date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  return await db().transaction(async (tx: any) => {
    // 1. Check if user already checked in today
    const existingCheckin = await tx
      .select()
      .from(dailyCheckins)
      .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today)))
      .limit(1);

    if (existingCheckin.length > 0) {
      throw new Error('You have already checked in today. Please come back tomorrow.');
    }

    // 2. Insert check-in record
    const checkinId = getUuid();
    await tx.insert(dailyCheckins).values({
      id: checkinId,
      userId: userId,
      checkinDate: today,
    });

    // 3. Get current user info
    const [currentUser] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!currentUser) {
      throw new Error('User not found');
    }

    // 4. Award credits (using credit system for consistency)
    const { createCredit, CreditTransactionType, CreditStatus } = await import('@/shared/models/credit');
    const { getSnowId } = await import('@/shared/lib/hash');
    
    await createCredit({
      id: getUuid(),
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.GRANT,
      transactionScene: CreditTransactionScene.AWARD,
      userId: userId,
      status: CreditStatus.ACTIVE,
      credits: CHECKIN_REWARD_CREDITS,
      remainingCredits: CHECKIN_REWARD_CREDITS,
      description: `Daily check-in reward: ${today}`,
      metadata: JSON.stringify({
        type: 'daily-checkin',
        checkinDate: today,
        checkinId: checkinId,
      }),
      expiresAt: null, // Check-in credits never expire
    });

    // 5. Update user's last check-in date
    await tx
      .update(user)
      .set({
        lastCheckinDate: today,
      })
      .where(eq(user.id, userId));

    // 6. Get updated credits balance
    const { getRemainingCredits } = await import('@/shared/models/credit');
    const newTotal = await getRemainingCredits(userId);

    return {
      success: true,
      addedCredits: CHECKIN_REWARD_CREDITS,
      newTotal: newTotal,
      checkinDate: today,
    };
  });
}

/**
 * Check if user can check in today
 * @param userId User ID
 * @returns Whether user can check in
 */
export async function canCheckInToday(userId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  const existingCheckin = await db()
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today)))
    .limit(1);

  return existingCheckin.length === 0;
}

