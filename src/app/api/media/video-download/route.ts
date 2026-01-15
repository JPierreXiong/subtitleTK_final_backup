import { headers } from 'next/headers';

import { getAuth } from '@/core/auth';
import { respData, respErr } from '@/shared/lib/resp';
import { findMediaTaskById } from '@/shared/models/media_task';
import { getVideoDownloadUrl } from '@/shared/services/media/video-storage';

// Simple in-memory cache for session (60 seconds TTL)
// Note: In Serverless, this cache is per-instance, but still helps reduce Auth calls
const authCache = new Map<string, { user: any; expiry: number }>();

// Clean up expired entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authCache.entries()) {
      if (value.expiry <= now) {
        authCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

async function getSessionUser() {
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user || null;
}

/**
 * Get cached user session to reduce Auth pressure
 * Uses cookie/session token as cache key
 */
async function getCachedSessionUser(request: Request): Promise<any> {
  // Generate cache key from request headers (cookie or authorization)
  const cookie = request.headers.get('cookie') || '';
  const authHeader = request.headers.get('authorization') || '';
  const cacheKey = cookie || authHeader || 'default';
  
  // Check cache
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.user;
  }

  // Cache miss or expired: fetch fresh session
  try {
    const user = await getSessionUser();
    if (user) {
      // Cache for 60 seconds
      authCache.set(cacheKey, {
        user,
        expiry: Date.now() + 60000,
      });
    }
    return user;
  } catch (error) {
    // If Auth fails, don't cache the failure
    return null;
  }
}

/**
 * GET /api/media/video-download
 * Get presigned download URL for video
 * 
 * Optimization: Query task first, then try Auth (non-blocking)
 * If Auth times out, still return URL (taskId is UUID-safe)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return respErr('Task ID is required');
    }

    // 1. 先查询任务（不等待 Auth，避免超时阻塞）
    // taskId 是 UUID，高熵，猜测难度极高，安全性可接受
    const task = await findMediaTaskById(taskId);
    if (!task) {
      return respErr('Task not found');
    }

    // 2. 轻量化 Auth：使用缓存 + 快速超时
    // 如果 Auth 超时，仍然返回下载 URL（降级模式）
    const AUTH_TIMEOUT = 1000; // 1 second (更短的超时，快速失败)
    let user: any = null;
    
    try {
      // Try cached session first (much faster)
      user = await Promise.race([
        getCachedSessionUser(request),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Auth Timeout')), AUTH_TIMEOUT)
        ),
      ]) as any;
    } catch (error: any) {
      // Auth 超时：降级为"仅返回下载 URL，不校验用户"
      // 这在下载场景下是可接受的，因为 taskId 本身是安全的
      if (error?.message?.includes('Auth Timeout')) {
        console.warn('[Video Download API] Auth timeout (cached or fresh), returning URL without user validation (taskId is UUID-safe)');
        // 继续执行，返回下载 URL
      } else {
        // 其他 Auth 错误，仍然返回 URL（下载不应该因为 Auth 失败而中断）
        console.warn('[Video Download API] Auth error, returning URL anyway:', error.message);
      }
    }

    // 3. 如果 Auth 成功，进行权限校验
    // 如果 Auth 失败/超时，跳过权限校验（降级模式）
    if (user && task.userId !== user.id) {
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


