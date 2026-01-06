/**
 * GET /api/user/checkin-status
 * Get daily check-in status for current user
 */

import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { canCheckInToday } from '@/shared/services/media/checkin';

/**
 * GET /api/user/checkin-status
 * Get check-in status
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


