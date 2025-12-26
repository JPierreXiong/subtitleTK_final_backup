/**
 * Plan limits checking service
 * Validates plan restrictions before allowing media tasks
 */

import { getUserInfo } from '@/shared/models/user';
import { getActiveMediaTasks } from '@/shared/models/media_task';
import { getPlanConfig, PlanType } from '@/shared/config/plans';
import { findSubscriptionBySubscriptionNo } from '@/shared/models/subscription';
import { db } from '@/core/db';
import { user, subscription } from '@/config/db/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface PlanLimitCheckResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
}

/**
 * Get user's current plan type
 */
export async function getUserPlanType(userId: string): Promise<PlanType> {
  const [userRecord] = await db()
    .select({ planType: user.planType })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return (userRecord?.planType as PlanType) || 'free';
}

/**
 * Get user's plan limits from subscription or user table
 */
export async function getUserPlanLimits(userId: string) {
  const planType = await getUserPlanType(userId);
  const planConfig = getPlanConfig(planType);

  // Get active subscription for additional limits
  const [userRecord] = await db()
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  // If user has active subscription, check subscription-specific limits
  let subscriptionLimits = null;
  if (planType !== 'free') {
    const [activeSubscription] = await db()
      .select()
      .from(subscription)
      .where(
        and(
          eq(subscription.userId, userId),
          eq(subscription.status, 'active')
        )
      )
      .orderBy(subscription.createdAt)
      .limit(1);

    if (activeSubscription) {
      subscriptionLimits = {
        maxVideoDuration: activeSubscription.maxVideoDuration,
        concurrentLimit: activeSubscription.concurrentLimit,
        exportFormats: activeSubscription.exportFormats
          ? JSON.parse(activeSubscription.exportFormats)
          : null,
        storageHours: activeSubscription.storageHours,
        translationCharLimit: activeSubscription.translationCharLimit,
      };
    }
  }

  return {
    planType,
    planConfig,
    subscriptionLimits,
    freeTrialUsed: userRecord?.freeTrialUsed || 0,
  };
}

/**
 * Check if user can use free trial
 */
export async function checkFreeTrial(userId: string): Promise<PlanLimitCheckResult> {
  const limits = await getUserPlanLimits(userId);

  if (limits.planType !== 'free') {
    return { allowed: true }; // Non-free plans don't use free trial
  }

  const freeTrialCount = limits.planConfig.freeTrialCount || 0;
  const freeTrialUsed = limits.freeTrialUsed || 0;

  if (freeTrialUsed >= freeTrialCount) {
    return {
      allowed: false,
      reason: `Free trial limit reached. You have used ${freeTrialUsed} of ${freeTrialCount} free trials.`,
      limit: freeTrialCount,
      current: freeTrialUsed,
    };
  }

  return {
    allowed: true,
    limit: freeTrialCount,
    current: freeTrialUsed,
  };
}

/**
 * Check video duration limit
 */
export async function checkVideoDuration(
  userId: string,
  duration: number
): Promise<PlanLimitCheckResult> {
  const limits = await getUserPlanLimits(userId);

  const maxDuration =
    limits.subscriptionLimits?.maxVideoDuration ??
    limits.planConfig.maxVideoDuration;

  if (maxDuration === null) {
    return { allowed: true }; // No limit
  }

  if (duration > maxDuration) {
    const minutes = Math.floor(maxDuration / 60);
    return {
      allowed: false,
      reason: `Video duration (${Math.floor(duration / 60)} min) exceeds your plan limit (${minutes} min).`,
      limit: maxDuration,
      current: duration,
    };
  }

  return { allowed: true, limit: maxDuration, current: duration };
}

/**
 * Check concurrent task limit
 */
export async function checkConcurrentLimit(
  userId: string
): Promise<PlanLimitCheckResult> {
  const limits = await getUserPlanLimits(userId);

  const concurrentLimit =
    limits.subscriptionLimits?.concurrentLimit ??
    limits.planConfig.concurrentLimit;

  if (concurrentLimit === null) {
    return { allowed: true }; // No limit
  }

  const activeTasks = await getActiveMediaTasks(userId);
  const currentCount = activeTasks.length;

  if (currentCount >= concurrentLimit) {
    return {
      allowed: false,
      reason: `You have ${currentCount} active task(s). Maximum concurrent tasks: ${concurrentLimit}.`,
      limit: concurrentLimit,
      current: currentCount,
    };
  }

  return {
    allowed: true,
    limit: concurrentLimit,
    current: currentCount,
  };
}

/**
 * Check translation character limit
 */
export async function checkTranslationLimit(
  userId: string,
  charCount: number
): Promise<PlanLimitCheckResult> {
  const limits = await getUserPlanLimits(userId);

  const charLimit =
    limits.subscriptionLimits?.translationCharLimit ??
    limits.planConfig.translationCharLimit;

  if (charLimit === null) {
    return { allowed: true }; // No limit
  }

  if (charCount > charLimit) {
    return {
      allowed: false,
      reason: `Translation text (${charCount} chars) exceeds your plan limit (${charLimit} chars).`,
      limit: charLimit,
      current: charCount,
    };
  }

  return { allowed: true, limit: charLimit, current: charCount };
}

/**
 * Check all plan limits for a media task
 */
export async function checkAllPlanLimits(params: {
  userId: string;
  outputType: 'subtitle' | 'video';
  duration?: number; // Video duration in seconds
  translationCharCount?: number; // Character count for translation
}): Promise<{
  allowed: boolean;
  errors: string[];
  warnings: string[];
  freeTrialAvailable: boolean;
}> {
  const { userId, outputType, duration, translationCharCount } = params;

  const errors: string[] = [];
  const warnings: string[] = [];
  let freeTrialAvailable = false;

  // 1. Check free trial
  const freeTrialCheck = await checkFreeTrial(userId);
  if (freeTrialCheck.allowed && freeTrialCheck.limit && freeTrialCheck.current !== undefined) {
    const remaining = freeTrialCheck.limit - freeTrialCheck.current;
    if (remaining > 0) {
      freeTrialAvailable = true;
    }
  } else if (!freeTrialCheck.allowed) {
    // Free trial exhausted, but user can still use credits
    // This is not an error, just a warning
    warnings.push(freeTrialCheck.reason || 'Free trial limit reached');
  }

  // 2. Check concurrent limit
  const concurrentCheck = await checkConcurrentLimit(userId);
  if (!concurrentCheck.allowed) {
    errors.push(concurrentCheck.reason || 'Concurrent limit exceeded');
  }

  // 3. Check video duration (if video output and duration provided)
  if (outputType === 'video' && duration !== undefined) {
    const durationCheck = await checkVideoDuration(userId, duration);
    if (!durationCheck.allowed) {
      errors.push(durationCheck.reason || 'Video duration limit exceeded');
    }
  }

  // 4. Check translation limit (if translation requested)
  if (translationCharCount !== undefined) {
    const translationCheck = await checkTranslationLimit(userId, translationCharCount);
    if (!translationCheck.allowed) {
      errors.push(translationCheck.reason || 'Translation character limit exceeded');
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
    warnings,
    freeTrialAvailable,
  };
}

/**
 * Get estimated credits cost for a task
 */
export function getEstimatedCreditsCost(
  outputType: 'subtitle' | 'video',
  includeTranslation: boolean = false
): number {
  const planConfig = getPlanConfig('free'); // Use free plan costs as base
  let cost = planConfig.creditsCost.extract;

  if (outputType === 'video') {
    cost += planConfig.creditsCost.video;
  }

  if (includeTranslation) {
    cost += planConfig.creditsCost.translate;
  }

  return cost;
}


