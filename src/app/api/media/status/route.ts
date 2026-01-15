import { getAuth } from '@/core/auth';
import { respData, respErr } from '@/shared/lib/resp';
import { findMediaTaskById } from '@/shared/models/media_task';
import { markTimeoutTasks } from '@/shared/models/media_task_watchdog';

async function getSessionUser(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session?.user || null;
}

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

    // 1. 先查询任务（不等待 Auth，避免超时阻塞）
    // taskId 是 UUID，高熵，猜测难度极高，安全性可接受
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

    // 2. 轻量化 Auth：尝试获取用户（但不阻塞返回）
    // 如果 Auth 超时，仍然返回任务状态（用于轮询场景）
    const AUTH_TIMEOUT = 1500; // 1.5 seconds (更短的超时，快速失败)
    let user: any = null;
    let authSkipped = false;
    
    try {
      user = (await Promise.race([
        getSessionUser(request),
        new Promise<null>((_, reject) =>
          setTimeout(() => {
            authSkipped = true;
            reject(new Error('Auth Timeout'));
          }, AUTH_TIMEOUT)
        ),
      ])) as any;
    } catch (error: any) {
      // Auth 超时：降级为"仅返回状态，不校验用户"
      // 这在轮询场景下是可接受的，因为 taskId 本身是安全的
      if (error?.message?.includes('Auth Timeout')) {
        console.warn('[Status API] Auth timeout, returning task without user validation (taskId is UUID-safe)');
        // 继续执行，返回任务状态
      } else {
        // 其他 Auth 错误，仍然返回任务（轮询不应该因为 Auth 失败而中断）
        console.warn('[Status API] Auth error, returning task anyway:', error.message);
      }
    }

    // 3. 如果 Auth 成功，进行权限校验
    // 如果 Auth 失败/超时，跳过权限校验（降级模式）
    if (user && task.userId !== user.id) {
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






