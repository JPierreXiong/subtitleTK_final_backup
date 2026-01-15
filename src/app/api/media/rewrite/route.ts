import { NextRequest, NextResponse } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  findMediaTaskById,
  updateMediaTaskById,
} from '@/shared/models/media_task';
import { rewriteContentWithGeminiStream } from '@/shared/services/media/gemini-translator';
import {
  consumeCredits,
  CreditTransactionScene,
  getRemainingCredits,
} from '@/shared/models/credit';
import { getEstimatedCreditsCost } from '@/shared/config/plans';

/**
 * POST /api/media/rewrite
 * Rewrite subtitle content using Gemini AI with streaming support
 * 
 * Uses Node.js Runtime for database compatibility
 * Streaming response prevents timeout by sending data immediately
 * CRITICAL: Must start streaming within 10s to prevent Vercel timeout
 */
export const maxDuration = 300; // 300 seconds for Pro tier

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, style, userRequirement } = body;

    // Validation
    if (!taskId) {
      return respErr('Task ID is required');
    }

    if (!style) {
      return respErr('Style is required');
    }

    // CRITICAL: Reduce DB operation timeout to 3s to ensure streaming starts within 10s
    const DB_TIMEOUT = 3000; // 3 seconds

    // Get current user (with aggressive timeout protection)
    let user;
    try {
      user = await Promise.race([
        getUserInfo(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getUserInfo timeout')), DB_TIMEOUT)
        )
      ]) as Awaited<ReturnType<typeof getUserInfo>>;
    } catch (error: any) {
      console.error('[Rewrite] getUserInfo failed:', error);
      return respErr('Failed to get user info. Please try again.');
    }
    
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Find task (with aggressive timeout protection)
    let task;
    try {
      task = await Promise.race([
        findMediaTaskById(taskId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('findMediaTaskById timeout')), DB_TIMEOUT)
        )
      ]) as Awaited<ReturnType<typeof findMediaTaskById>>;
    } catch (error: any) {
      console.error('[Rewrite] findMediaTaskById failed:', error);
      return respErr('Failed to find task. Please try again.');
    }
    
    if (!task) {
      return respErr('Task not found');
    }

    // Check permission
    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    // Check task status - must be extracted or completed
    if (task.status !== 'extracted' && task.status !== 'completed') {
      return respErr(
        `Task is not ready for rewriting. Current status: ${task.status}`
      );
    }

    // Check if subtitle exists
    if (!task.subtitleRaw || task.subtitleRaw.trim().length === 0) {
      return respErr('No subtitle content to rewrite');
    }

    // Check credits (rewrite costs 10 credits) - with aggressive timeout protection
    const requiredCredits = 10;
    let remainingCredits;
    try {
      remainingCredits = await Promise.race([
        getRemainingCredits(user.id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getRemainingCredits timeout')), DB_TIMEOUT)
        )
      ]) as Awaited<ReturnType<typeof getRemainingCredits>>;
    } catch (error: any) {
      console.error('[Rewrite] getRemainingCredits failed:', error);
      return respErr('Failed to check credits. Please try again.');
    }
    
    if (remainingCredits < requiredCredits) {
      return respErr(
        `Insufficient credits for rewriting. Required: ${requiredCredits}, Available: ${remainingCredits}`
      );
    }

    // Check if task is free trial
    const isFreeTrial = task.isFreeTrial || false;

    // Consume credits (if not free trial) - with aggressive timeout protection
    let consumedCredit = null;
    if (!isFreeTrial) {
      try {
        consumedCredit = await Promise.race([
          consumeCredits({
            userId: user.id,
            credits: requiredCredits,
            scene: CreditTransactionScene.PAYMENT,
            description: `Content rewriting: ${style}${userRequirement ? ' (custom)' : ''}`,
            metadata: JSON.stringify({
              type: 'media-task-rewrite',
              taskId,
              style,
              hasCustomRequirement: !!userRequirement,
            }),
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('consumeCredits timeout')), DB_TIMEOUT)
          )
        ]) as Awaited<ReturnType<typeof consumeCredits>>;
      } catch (error: any) {
        console.error('[Rewrite] consumeCredits failed:', error);
        return respErr('Failed to consume credits. Please try again.');
      }
    }

    // CRITICAL: Start streaming immediately to prevent Vercel timeout
    // Vercel will not timeout if there's an active stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        try {
          // Send initial heartbeat immediately (prevents timeout)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'started' })}\n\n`)
          );

          // Start rewriting with streaming (userRequirement is optional)
          const rewriteStream = rewriteContentWithGeminiStream(
            task.subtitleRaw!,
            style,
            userRequirement?.trim() || undefined
          );

          // Stream chunks as they arrive
          for await (const chunk of rewriteStream) {
            fullContent += chunk;

            // Send chunk to client in SSE format immediately
            const data = JSON.stringify({ text: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send completion signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );

          // Save rewritten content to database (async, don't block response)
          // Use waitUntil for Vercel to keep function alive during async operation
          const savePromise = updateMediaTaskById(taskId, {
            subtitleRewritten: fullContent,
          }).catch((error) => {
            console.error('[Rewrite] Failed to save rewritten content:', error);
          });

          // Try to use waitUntil if available (Vercel Serverless Functions)
          try {
            const { waitUntil } = await import('@vercel/functions');
            waitUntil(savePromise);
          } catch (e) {
            // waitUntil not available, just fire and forget
            // The promise will complete in background
          }

          controller.close();
        } catch (error: any) {
          console.error('[Rewrite] Stream error:', error);

          // Refund credits on error (if not free trial) - async, don't block
          if (!isFreeTrial && consumedCredit) {
            const refundPromise = updateMediaTaskById(taskId, {
              status: 'failed',
              errorMessage: error.message || 'Rewrite failed',
              creditId: consumedCredit.id,
            }).catch((refundError) => {
              console.error('[Rewrite] Failed to refund credits:', refundError);
            });

            // Try to use waitUntil for refund
            try {
              const { waitUntil } = await import('@vercel/functions');
              waitUntil(refundPromise);
            } catch (e) {
              // Fire and forget
            }
          }

          // Send error to client
          const errorData = JSON.stringify({
            error: error.message || 'Rewrite failed',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Media rewrite failed:', error);
    return respErr(error.message || 'Failed to rewrite content');
  }
}
