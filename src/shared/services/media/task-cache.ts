/**
 * Task Cache Service
 * Handles caching of completed media tasks to reduce RapidAPI calls
 * 
 * Strategy: Find completed tasks with same URL and outputType within 24 hours
 * This can save significant RapidAPI costs for popular videos
 */

import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { eq, and, gt, desc, or } from 'drizzle-orm';

export interface CachedTaskData {
  id: string;
  subtitleRaw: string | null;
  subtitleTranslated: string | null;
  videoUrlInternal: string | null;
  expiresAt: Date | null;
  title: string | null;
  author: string | null;
  platform: string;
  thumbnailUrl: string | null;
  duration: number | null;
  likes: number | null;
  views: number | null;
  shares: number | null;
  publishedAt: Date | null;
  sourceLang: string | null;
}

/**
 * Find cached completed task
 * Looks for a completed task with the same URL and outputType within 24 hours
 * 
 * @param url Video URL
 * @param outputType Output type: 'subtitle' | 'video'
 * @returns Cached task data or null
 */
export async function findCachedTask(
  url: string,
  outputType: 'subtitle' | 'video'
): Promise<CachedTaskData | null> {
  // Calculate 24 hours ago
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  try {
    // Find the most recent completed task with same URL and outputType
    // Status can be 'extracted' (ready for translation) or 'completed' (fully done)
    // Both are valid for caching
    const cachedTask = await db()
      .select()
      .from(mediaTasks)
      .where(
        and(
          eq(mediaTasks.videoUrl, url), // Same URL
          eq(mediaTasks.outputType, outputType), // Same output type
          // Status can be 'extracted' or 'completed' - both are valid
          or(
            eq(mediaTasks.status, 'extracted'),
            eq(mediaTasks.status, 'completed')
          ),
          gt(mediaTasks.createdAt, oneDayAgo) // Within 24 hours
        )
      )
      .orderBy(desc(mediaTasks.createdAt))
      .limit(1);

    if (cachedTask.length === 0) {
      return null;
    }

    const task = cachedTask[0];

    // Check if task has required data
    // For subtitle tasks: need subtitleRaw
    // For video tasks: need videoUrlInternal
    if (outputType === 'subtitle' && !task.subtitleRaw) {
      return null; // Subtitle task without subtitle data
    }
    if (outputType === 'video' && !task.videoUrlInternal) {
      return null; // Video task without video data
    }

    // Check if video is expired (for video tasks)
    if (outputType === 'video' && task.expiresAt) {
      const now = new Date();
      if (task.expiresAt < now) {
        return null; // Video has expired
      }
    }

    // Return cached task data
    return {
      id: task.id,
      subtitleRaw: task.subtitleRaw,
      subtitleTranslated: task.subtitleTranslated,
      videoUrlInternal: task.videoUrlInternal,
      expiresAt: task.expiresAt,
      title: task.title,
      author: task.author,
      platform: task.platform,
      thumbnailUrl: task.thumbnailUrl,
      duration: task.duration,
      likes: task.likes,
      views: task.views,
      shares: task.shares,
      publishedAt: task.publishedAt,
      sourceLang: task.sourceLang,
    };
  } catch (error: any) {
    console.error('[Task Cache] Error finding cached task', {
      url: url.substring(0, 100),
      outputType,
      error: error.message,
    });
    return null; // Return null on error, allow normal flow to continue
  }
}

/**
 * Check if a task can be cached (has all required data)
 * 
 * @param task Task data
 * @param outputType Output type
 * @returns True if task can be cached
 */
export function canCacheTask(
  task: CachedTaskData,
  outputType: 'subtitle' | 'video'
): boolean {
  if (outputType === 'subtitle') {
    return !!task.subtitleRaw;
  }
  if (outputType === 'video') {
    return !!task.videoUrlInternal && 
           (!task.expiresAt || task.expiresAt > new Date());
  }
  return false;
}
