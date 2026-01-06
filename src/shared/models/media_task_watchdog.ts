/**
 * Media Task Watchdog (Soft Constraint Version)
 * 防尸体任务的核心机制 - 不改表结构版
 * 
 * 原理：
 * - processing 是不稳定态，必须被时间"威胁"
 * - 使用 updated_at 代替 started_at（不新增字段）
 * - timeout 是逻辑状态，实际存储为 'failed'，通过 error_message 区分
 * 
 * 核心公式：
 *   status = 'processing' AND updated_at < now() - 90 seconds
 *   → 强制标记为 'failed' (timeout)
 */

import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { updateMediaTaskById } from './media_task';

/**
 * Maximum task execution time (in seconds)
 * For Vercel Free tier: 90 seconds (leaving buffer for 10s limit)
 * For Vercel Pro: can be increased to 300 seconds
 */
const MAX_TASK_TIME_SECONDS = 90; // 90 seconds

/**
 * Mark timeout tasks (Watchdog)
 * 
 * 使用 updated_at 判断超时（不依赖 started_at 字段）
 * timeout 逻辑状态映射为 'failed'，通过 error_message 区分
 * 
 * This function should be called:
 * 1. Before querying task status (in status API) - 最重要
 * 2. Periodically via cron job
 * 3. On task submission
 * 
 * @returns Number of tasks marked as timeout
 */
export async function markTimeoutTasks(): Promise<number> {
  const timeoutThreshold = new Date();
  timeoutThreshold.setSeconds(timeoutThreshold.getSeconds() - MAX_TASK_TIME_SECONDS);

  // Find all processing tasks that have exceeded the time limit
  // Using updated_at instead of started_at (soft constraint)
  const timeoutTasks = await db()
    .select({
      id: mediaTasks.id,
      userId: mediaTasks.userId,
      creditId: mediaTasks.creditId,
      updatedAt: mediaTasks.updatedAt,
    })
    .from(mediaTasks)
    .where(
      and(
        eq(mediaTasks.status, 'processing'),
        // Task updated_at is older than MAX_TASK_TIME_SECONDS
        // This means task has been stuck in processing for too long
        lt(mediaTasks.updatedAt, timeoutThreshold)
      )
    );

  if (timeoutTasks.length === 0) {
    return 0;
  }

  console.log(`[Watchdog] Found ${timeoutTasks.length} timeout tasks`);

  // Mark each task as failed (timeout is logical state, stored as failed)
  // This will trigger automatic refund in updateMediaTaskById
  let markedCount = 0;
  for (const task of timeoutTasks) {
    try {
      // Update task status to 'failed' with timeout error message
      // The error_message distinguishes timeout from other failures
      await updateMediaTaskById(task.id, {
        status: 'failed',
        errorMessage: `Task timeout (watchdog): Exceeded ${MAX_TASK_TIME_SECONDS} seconds`,
        progress: 0,
        creditId: task.creditId || null,
      });

      markedCount++;
      console.log(`[Watchdog] Marked task ${task.id} as timeout (stored as failed)`);
    } catch (error: any) {
      console.error(`[Watchdog] Failed to mark task ${task.id} as timeout:`, error.message);
    }
  }

  return markedCount;
}

/**
 * Get timeout threshold timestamp
 * Useful for queries and monitoring
 */
export function getTimeoutThreshold(): Date {
  const threshold = new Date();
  threshold.setSeconds(threshold.getSeconds() - MAX_TASK_TIME_SECONDS);
  return threshold;
}

/**
 * Check if a task is likely to timeout (using updated_at)
 * @param updatedAt Task last update time
 * @param status Task status
 * @returns true if task is likely to timeout
 */
export function isTaskLikelyTimeout(updatedAt: Date | null, status: string): boolean {
  if (!updatedAt || status !== 'processing') {
    return false;
  }

  const elapsed = (Date.now() - updatedAt.getTime()) / 1000; // seconds
  return elapsed > MAX_TASK_TIME_SECONDS;
}

/**
 * Check if a task is a timeout failure (by error_message)
 * @param status Task status
 * @param errorMessage Task error message
 * @returns true if task failed due to timeout
 */
export function isTimeoutFailure(status: string, errorMessage: string | null): boolean {
  return (
    status === 'failed' &&
    errorMessage !== null &&
    errorMessage.includes('timeout') &&
    errorMessage.includes('watchdog')
  );
}

