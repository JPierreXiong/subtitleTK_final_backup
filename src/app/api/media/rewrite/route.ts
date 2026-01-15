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
 */
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

    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Find task
    const task = await findMediaTaskById(taskId);
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

    // Check credits (rewrite costs 10 credits)
    const requiredCredits = 10;
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < requiredCredits) {
      return respErr(
        `Insufficient credits for rewriting. Required: ${requiredCredits}, Available: ${remainingCredits}`
      );
    }

    // Check if task is free trial
    const isFreeTrial = task.isFreeTrial || false;

    // Consume credits (if not free trial)
    let consumedCredit = null;
    if (!isFreeTrial) {
      consumedCredit = await consumeCredits({
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
      });
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        try {
          // Start rewriting with streaming (userRequirement is optional)
          const rewriteStream = rewriteContentWithGeminiStream(
            task.subtitleRaw!,
            style,
            userRequirement?.trim() || undefined
          );

          for await (const chunk of rewriteStream) {
            fullContent += chunk;

            // Send chunk to client in SSE format
            const data = JSON.stringify({ text: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send completion signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );

          // Save rewritten content to database (async, don't block)
          updateMediaTaskById(taskId, {
            subtitleRewritten: fullContent,
          }).catch((error) => {
            console.error('[Rewrite] Failed to save rewritten content:', error);
          });

          controller.close();
        } catch (error: any) {
          console.error('[Rewrite] Stream error:', error);

          // Refund credits on error (if not free trial)
          if (!isFreeTrial && consumedCredit) {
            // Credit refund logic would be handled by updateMediaTaskById on status change
            await updateMediaTaskById(taskId, {
              status: 'failed',
              errorMessage: error.message || 'Rewrite failed',
              creditId: consumedCredit.id,
            });
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
