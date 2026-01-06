import { respData, respErr } from '@/shared/lib/resp';
import { findMediaTaskById } from '@/shared/models/media_task';
import { getUserInfo } from '@/shared/models/user';
import { getVideoDownloadUrl } from '@/shared/services/media/video-storage';

/**
 * GET /api/media/video-download
 * Get presigned download URL for video
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return respErr('Task ID is required');
    }

    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Find task
    const task = await findMediaTaskById(taskId);
    if (!task) {
      return respErr('Task not found');
    }

    // Check permission
    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    // Check if video exists
    if (!task.videoUrlInternal) {
      return respErr('Video not available');
    }

    // Check if it's an original URL (not stored in storage)
    if (task.videoUrlInternal.startsWith('original:')) {
      // Extract original URL
      const originalUrl = task.videoUrlInternal.replace('original:', '');
      return respData({
        downloadUrl: originalUrl,
        expiresAt: task.expiresAt,
      });
    }

    // Get download URL (handles Vercel Blob, R2, or legacy formats)
    try {
      const downloadUrl = await getVideoDownloadUrl(task.videoUrlInternal);
      if (!downloadUrl) {
        return respErr('Failed to generate download URL');
      }
      return respData({
        downloadUrl,
        expiresAt: task.expiresAt,
      });
    } catch (error: any) {
      console.error('Video download URL generation failed:', error);
      return respErr(error.message || 'Failed to generate download URL');
    }
  } catch (error: any) {
    console.error('Video download URL generation failed:', error);
    return respErr(error.message || 'Failed to generate download URL');
  }
}


