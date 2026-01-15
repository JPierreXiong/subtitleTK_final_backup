/**
 * Internal Media Task Processing API
 * This endpoint handles long-running media processing tasks
 * Called internally from submit endpoint to avoid Vercel timeout limits
 * 
 * Note: This endpoint can have longer timeout settings in vercel.json
 */

import { NextRequest } from 'next/server';

/**
 * Configure max duration for this route
 * This endpoint handles long-running tasks (video download, upload, etc.)
 * Vercel Free tier: 10s (cannot be overridden)
 * Vercel Pro tier: up to 300s (5 minutes)
 */
export const maxDuration = 180; // 3 minutes (for Vercel Pro tier)
import { respData, respErr } from '@/shared/lib/resp';
import { processMediaTask } from '../submit/route';

/**
 * POST /api/media/process-internal
 * Internal endpoint for processing media tasks
 * This endpoint is called internally and can have longer timeout settings
 * 
 * Security: Should only be called from internal services
 * In production, consider adding authentication/authorization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, url, outputType, userId } = body;

    // Validation
    if (!taskId || !url || !outputType || !userId) {
      return respErr('Missing required fields: taskId, url, outputType, userId');
    }

    // Validate output type
    if (outputType !== 'subtitle' && outputType !== 'video') {
      return respErr('Invalid output type. Must be "subtitle" or "video".');
    }

    // Process task asynchronously (don't await to allow response to return quickly)
    // The processMediaTask function will handle all state updates and error handling
    processMediaTask(taskId, url, outputType, userId).catch(async (error) => {
      console.error('[Process Internal] Task processing failed', {
        taskId,
        url,
        outputType,
        error: error.message,
        stack: error.stack,
      });
      
      // Error handling is done inside processMediaTask
      // This catch is just for logging
    });

    // Return immediately to avoid timeout
    // The actual processing happens in the background
    return respData({
      success: true,
      message: 'Task processing started',
      taskId,
    });
  } catch (error: any) {
    console.error('[Process Internal] Request failed:', error);
    return respErr(error.message || 'Failed to start task processing');
  }
}

/**
 * GET /api/media/process-internal
 * Health check endpoint
 */
export async function GET() {
  return respData({
    status: 'ok',
    message: 'Process internal endpoint is running',
  });
}
