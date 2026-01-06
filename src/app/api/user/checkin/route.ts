/**
 * POST /api/user/checkin
 * Daily check-in API endpoint
 */

import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { performDailyCheckin, canCheckInToday } from '@/shared/services/media/checkin';

/**
 * POST /api/user/checkin
 * Perform daily check-in
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('Unauthorized. Please sign in.');
    }

    // Check if user can check in today
    const canCheckIn = await canCheckInToday(user.id);
    if (!canCheckIn) {
      return respErr('You have already checked in today. Please come back tomorrow.');
    }

    // Perform check-in
    const result = await performDailyCheckin(user.id);

    return respData({
      success: true,
      message: `Check-in successful! You earned ${result.addedCredits} credits.`,
      addedCredits: result.addedCredits,
      newTotal: result.newTotal,
      checkinDate: result.checkinDate,
    });
  } catch (error: any) {
    console.error('Daily check-in failed:', error);
    return respErr(error.message || 'Failed to perform check-in');
  }
}

/**
 * GET /api/user/checkin
 * Check if user can check in today
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('Unauthorized. Please sign in.');
    }

    // Check if user can check in today
    const canCheckIn = await canCheckInToday(user.id);

    return respData({
      canCheckIn,
      message: canCheckIn
        ? 'You can check in today!'
        : 'You have already checked in today.',
    });
  } catch (error: any) {
    console.error('Check check-in status failed:', error);
    return respErr(error.message || 'Failed to check check-in status');
  }
}


