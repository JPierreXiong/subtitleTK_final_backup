/**
 * Storage Cleanup Service
 * Handles cleanup of expired Vercel Blob files to reduce storage costs
 * 
 * Strategy:
 * 1. Find tasks with expired expiresAt
 * 2. Extract Blob identifiers from videoUrlInternal
 * 3. Delete expired Blob files
 * 4. Update task records (optional: mark as expired)
 */

import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { and, lt, isNotNull, ne } from 'drizzle-orm';
import { del } from '@vercel/blob';

/**
 * Extract Blob identifier from videoUrlInternal
 * Supports formats:
 * - vercel-blob:https://xxx.vercel-storage.com/path/to/file.mp4
 * - https://xxx.vercel-storage.com/path/to/file.mp4
 * 
 * @param videoUrlInternal Storage identifier
 * @returns Blob key or null
 */
function extractBlobKey(videoUrlInternal: string): string | null {
  if (!videoUrlInternal) {
    return null;
  }

  // Remove vercel-blob: prefix if present
  let url = videoUrlInternal.replace(/^vercel-blob:/, '');

  // Extract key from Vercel Blob URL
  // Format: https://{hash}.public.blob.vercel-storage.com/{key}
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Remove leading slash
    const key = pathname.startsWith('/') ? pathname.substring(1) : pathname;
    
    return key || null;
  } catch (error) {
    // If URL parsing fails, try to extract key directly
    // Assume format: videos/{taskId}.mp4 or similar
    const match = url.match(/videos\/[^\/]+\.mp4/);
    return match ? match[0] : null;
  }
}

/**
 * Clean up expired video files from Vercel Blob
 * Finds tasks with expired expiresAt and deletes corresponding Blob files
 * 
 * @returns Number of files cleaned up
 */
export async function cleanupExpiredVideos(): Promise<number> {
  const now = new Date();
  let cleanedCount = 0;

  try {
    // Find all tasks with expired videos
    const expiredTasks = await db()
      .select({
        id: mediaTasks.id,
        videoUrlInternal: mediaTasks.videoUrlInternal,
      })
      .from(mediaTasks)
      .where(
        and(
          isNotNull(mediaTasks.videoUrlInternal), // Has video
          isNotNull(mediaTasks.expiresAt), // Has expiration
          lt(mediaTasks.expiresAt, now), // Expired
          // Only process tasks that haven't been cleaned yet
          // You can add a 'cleaned' flag if needed
        )
      )
      .limit(100); // Process in batches to avoid timeout

    console.log(`[Storage Cleanup] Found ${expiredTasks.length} expired video tasks`);

    // Delete Blob files
    for (const task of expiredTasks) {
      if (!task.videoUrlInternal) {
        continue;
      }

      try {
        const blobKey = extractBlobKey(task.videoUrlInternal);
        
        if (!blobKey) {
          console.warn(`[Storage Cleanup] Could not extract blob key from: ${task.videoUrlInternal}`);
          continue;
        }

        // Delete from Vercel Blob
        await del(blobKey);
        cleanedCount++;

        console.log(`[Storage Cleanup] Deleted expired video: ${blobKey} (task: ${task.id})`);
      } catch (deleteError: any) {
        // Log error but continue with other files
        console.error(`[Storage Cleanup] Failed to delete video for task ${task.id}`, {
          error: deleteError.message,
          videoUrlInternal: task.videoUrlInternal?.substring(0, 100),
        });
      }
    }

    console.log(`[Storage Cleanup] Cleaned up ${cleanedCount} expired video files`);
    return cleanedCount;
  } catch (error: any) {
    console.error('[Storage Cleanup] Error during cleanup', {
      error: error.message,
      stack: error.stack,
    });
    return cleanedCount;
  }
}

/**
 * Get storage statistics
 * Returns count of tasks with videos and total storage usage estimate
 */
export async function getStorageStats(): Promise<{
  totalTasksWithVideos: number;
  expiredTasks: number;
  activeTasks: number;
}> {
  const now = new Date();

  try {
    // Count total tasks with videos
    const [totalResult] = await db()
      .select({ count: mediaTasks.id })
      .from(mediaTasks)
      .where(isNotNull(mediaTasks.videoUrlInternal));

    const totalTasksWithVideos = totalResult?.count ? Number(totalResult.count) : 0;

    // Count expired tasks
    const [expiredResult] = await db()
      .select({ count: mediaTasks.id })
      .from(mediaTasks)
      .where(
        and(
          isNotNull(mediaTasks.videoUrlInternal),
          isNotNull(mediaTasks.expiresAt),
          lt(mediaTasks.expiresAt, now)
        )
      );

    const expiredTasks = expiredResult?.count ? Number(expiredResult.count) : 0;
    const activeTasks = totalTasksWithVideos - expiredTasks;

    return {
      totalTasksWithVideos,
      expiredTasks,
      activeTasks,
    };
  } catch (error: any) {
    console.error('[Storage Stats] Error getting storage stats', {
      error: error.message,
    });
    return {
      totalTasksWithVideos: 0,
      expiredTasks: 0,
      activeTasks: 0,
    };
  }
}
