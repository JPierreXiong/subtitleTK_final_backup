import { respData, respErr } from '@/shared/lib/resp';
import { getMediaTaskHistory } from '@/shared/models/media_task';
import { getUserInfo } from '@/shared/models/user';

/**
 * GET /api/media/history
 * Get media task history for current user
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '20');

    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Validate pagination params
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100); // Max 100 items per page

    // Get history
    const history = await getMediaTaskHistory(user.id, safePage, safeLimit);

    return respData(history);
  } catch (error: any) {
    console.error('Media history query failed:', error);
    return respErr(error.message || 'Failed to fetch media history');
  }
}


