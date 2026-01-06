/**
 * Task Heartbeat Utility
 * 简单的心跳机制，防止 watchdog 误杀正在执行的任务
 * 
 * 原理：
 * - 在关键步骤更新 updated_at
 * - watchdog 通过 updated_at 判断任务是否超时
 * - 如果 updated_at 在最近更新，说明任务还在执行
 * 
 * 不改表结构，只更新现有字段
 */

import { updateMediaTaskById } from '@/shared/models/media_task';

/**
 * Send heartbeat for a task
 * Updates updated_at to prevent watchdog from killing active tasks
 * 
 * @param taskId Task ID
 * @param progress Optional progress update (0-100)
 */
export async function sendTaskHeartbeat(
  taskId: string,
  progress?: number
): Promise<void> {
  try {
    // 只更新 progress（如果提供），updated_at 会自动更新（ShipAny 行为）
    // 这样 watchdog 就知道任务还在执行
    await updateMediaTaskById(taskId, {
      ...(progress !== undefined && { progress }),
      // 不显式设置 updated_at，让 ShipAny 的 $onUpdate 自动处理
    });
  } catch (error: any) {
    // 心跳失败不应该中断任务执行
    console.warn(`[Heartbeat Failed] Task ${taskId}:`, error.message);
  }
}

/**
 * Send heartbeat with a delay
 * Useful for long-running operations
 * 
 * @param taskId Task ID
 * @param delayMs Delay in milliseconds before sending heartbeat
 * @param progress Optional progress update
 */
export async function sendDelayedHeartbeat(
  taskId: string,
  delayMs: number = 20000, // 20 seconds default
  progress?: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(async () => {
      await sendTaskHeartbeat(taskId, progress);
      resolve();
    }, delayMs);
  });
}


