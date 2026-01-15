/**
 * Upstash QStash Queue Service
 * Handles task enqueueing for Worker processing
 */

import { Client } from '@upstash/qstash';

let qstashClient: Client | null = null;

/**
 * Get QStash client instance
 */
function getQStashClient(): Client {
  if (!qstashClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
      throw new Error('QSTASH_TOKEN environment variable is not set');
    }
    qstashClient = new Client({
      token,
    });
  }
  return qstashClient;
}

/**
 * Enqueue media task to Worker via QStash
 * @param taskId Task ID
 * @param url Video URL
 * @param outputType Output type: 'subtitle' | 'video'
 * @param userId User ID
 */
export async function enqueueMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    throw new Error('WORKER_URL environment variable is not set');
  }

  const client = getQStashClient();

  try {
    await client.publishJSON({
      url: `${workerUrl}/api/worker/process`,
      body: {
        taskId,
        url,
        outputType,
        userId,
      },
      retries: 3, // 最多重试 3 次
      delay: 0, // 立即执行
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`[QStash] Task ${taskId} enqueued successfully`);
  } catch (error: any) {
    console.error('[QStash Error]', {
      taskId,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Failed to enqueue task: ${error.message}`);
  }
}

/**
 * Check if Worker/Queue is enabled
 */
export function isWorkerEnabled(): boolean {
  return (
    process.env.USE_WORKER === 'true' &&
    !!process.env.QSTASH_TOKEN &&
    !!process.env.WORKER_URL
  );
}



