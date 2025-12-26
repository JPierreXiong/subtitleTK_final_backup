import { PERMISSIONS } from '@/core/rbac';
import { respData, respErr } from '@/shared/lib/resp';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { hasPermission } from '@/shared/services/rbac';
import { getUserPlanLimits } from '@/shared/services/media/plan-limits';
import { PLAN_CONFIG, PlanType } from '@/shared/config/plans';

export async function POST(req: Request) {
  try {
    // get sign user info
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // check if user is admin
    const isAdmin = await hasPermission(user.id, PERMISSIONS.ADMIN_ACCESS);

    // get remaining credits
    const remainingCredits = await getRemainingCredits(user.id);

    // get plan information
    const planLimits = await getUserPlanLimits(user.id);
    const planConfig = PLAN_CONFIG[planLimits.planType as PlanType] || PLAN_CONFIG.free;

    return respData({ 
      ...user, 
      isAdmin, 
      credits: { remainingCredits },
      planType: planLimits.planType,
      freeTrialUsed: planLimits.freeTrialUsed || 0,
      planLimits: {
        maxVideoDuration: planLimits.subscriptionLimits?.maxVideoDuration ?? planConfig.maxVideoDuration,
        concurrentLimit: planLimits.subscriptionLimits?.concurrentLimit ?? planConfig.concurrentLimit,
        translationCharLimit: planLimits.subscriptionLimits?.translationCharLimit ?? planConfig.translationCharLimit,
        freeTrialCount: planConfig.freeTrialCount || 0,
      },
    });
  } catch (e) {
    console.log('get user info failed:', e);
    return respErr('get user info failed');
  }
}
