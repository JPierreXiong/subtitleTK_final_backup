import { respData, respErr } from '@/shared/lib/resp';
import { findMediaTaskById } from '@/shared/models/media_task';
import { getUserInfo } from '@/shared/models/user';
import { markTimeoutTasks } from '@/shared/models/media_task_watchdog';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return respErr('Task ID is required');
    }

    // 0. Watchdog: Mark timeout tasks before querying (防尸体任务)
    // This ensures that even without cron, we can kill zombie tasks
    try {
      const timeoutCount = await markTimeoutTasks();
      if (timeoutCount > 0) {
        console.log(`[Watchdog] Marked ${timeoutCount} tasks as timeout`);
      }
    } catch (watchdogError: any) {
      // Don't fail the request if watchdog fails, just log it
      console.error('[Watchdog Error]', watchdogError.message);
    }

    // 1. 增加超时检查，防止 getUserInfo 挂死整个请求
    const AUTH_TIMEOUT = 5000; // 5 seconds
    const user = await Promise.race([
      getUserInfo(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Auth Timeout: getUserInfo took longer than 5 seconds')), AUTH_TIMEOUT)
      ),
    ]) as any;

    if (!user) {
      return respErr('no auth, please sign in');
    }

    // 2. 增加超时检查，防止 findMediaTaskById 挂死
    const DB_QUERY_TIMEOUT = 5000; // 5 seconds
    const task = await Promise.race([
      findMediaTaskById(taskId),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Database Timeout: findMediaTaskById took longer than 5 seconds')), DB_QUERY_TIMEOUT)
      ),
    ]) as any;

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
    // 关键：在这里打印具体的堆栈，以便在 Vercel Logs 中看到是哪一行崩了
    console.error('[API_STATUS_ERROR]', {
      message: e.message,
      name: e.name,
      stack: e.stack,
      timestamp: new Date().toISOString(),
    });
    return respErr(`Internal Server Error: ${e.message}`);
  }
}






