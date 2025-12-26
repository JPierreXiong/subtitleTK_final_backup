import { respData, respErr } from '@/shared/lib/resp';
import { findMediaTaskById } from '@/shared/models/media_task';
import { getUserInfo } from '@/shared/models/user';

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

    return respData({
      id: task.id,
      status: task.status,
      progress: task.progress,
      srtUrl: task.srtUrl,
      translatedSrtUrl: task.translatedSrtUrl,
      resultVideoUrl: task.resultVideoUrl,
      errorMessage: task.errorMessage,
      sourceLang: task.sourceLang,
      targetLang: task.targetLang,
      title: task.title,
      platform: task.platform,
      // New fields
      subtitleRaw: task.subtitleRaw,
      subtitleTranslated: task.subtitleTranslated,
      videoUrlInternal: task.videoUrlInternal,
      expiresAt: task.expiresAt,
      outputType: task.outputType,
      // Metadata
      author: task.author,
      likes: task.likes,
      views: task.views,
      shares: task.shares,
      thumbnailUrl: task.thumbnailUrl,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  } catch (e: any) {
    console.log('media status query failed', e);
    return respErr(e.message);
  }
}






