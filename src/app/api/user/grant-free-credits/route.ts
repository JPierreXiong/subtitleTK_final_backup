import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  createCredit,
  CreditStatus,
  CreditTransactionType,
  CreditTransactionScene,
  calculateCreditExpirationTime,
} from '@/shared/models/credit';
import { getSnowId, getUuid } from '@/shared/lib/hash';

/**
 * Grant free plan credits to new users
 * This endpoint should be called after user registration
 */
export async function POST(req: Request) {
  try {
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Check if user already has credits (avoid duplicate grants)
    const { getRemainingCredits } = await import('@/shared/models/credit');
    const existingCredits = await getRemainingCredits(user.id);
    
    if (existingCredits > 0) {
      // User already has credits, don't grant again
      return respData({
        message: 'User already has credits',
        credits: existingCredits,
      });
    }

    // Free plan: 50 credits, valid for 7 days
    const freePlanCredits = 50;
    const freePlanValidDays = 7;

    const expiresAt = calculateCreditExpirationTime({
      creditsValidDays: freePlanValidDays,
    });

    const newCredit = {
      id: getUuid(),
      userId: user.id,
      userEmail: user.email,
      orderNo: null, // No order for free plan
      subscriptionNo: null, // No subscription for free plan
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.GRANT,
      transactionScene: CreditTransactionScene.GIFT, // Free credits are considered a gift
      credits: freePlanCredits,
      remainingCredits: freePlanCredits,
      description: 'Welcome bonus: Free plan credits',
      expiresAt: expiresAt,
      status: CreditStatus.ACTIVE,
    };

    await createCredit(newCredit);

    return respData({
      message: 'Free credits granted successfully',
      credits: freePlanCredits,
      validDays: freePlanValidDays,
    });
  } catch (e: any) {
    console.log('grant free credits failed:', e);
    return respErr(e.message || 'Failed to grant free credits');
  }
}

