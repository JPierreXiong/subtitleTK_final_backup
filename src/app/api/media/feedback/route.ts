import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { findMediaTaskById } from '@/shared/models/media_task';
import { createRewriteFeedback, getRewriteFeedbackByTaskId } from '@/shared/models/rewrite_feedback';

/**
 * POST /api/media/feedback
 * Submit feedback for AI rewrite feature
 * Only authenticated users can submit feedback
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    const body = await request.json();
    const { taskId, rating, comment, style, metadata } = body;

    // Validation
    if (!taskId) {
      return respErr('Task ID is required');
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return respErr('Rating must be a number between 1 and 5');
    }

    // Verify task exists and belongs to user
    const task = await findMediaTaskById(taskId);
    if (!task) {
      return respErr('Task not found');
    }

    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    // Check if feedback already exists for this task
    const existingFeedback = await getRewriteFeedbackByTaskId(taskId);
    if (existingFeedback) {
      return respErr('Feedback already submitted for this task');
    }

    // Create feedback
    const feedback = await createRewriteFeedback({
      userId: user.id,
      taskId,
      rating,
      comment: comment?.trim() || null,
      style: style || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });

    return respData({
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        createdAt: feedback.createdAt,
      },
      message: 'Feedback submitted successfully',
    });
  } catch (error: any) {
    console.error('[Feedback] Error:', error);
    return respErr(error.message || 'Failed to submit feedback');
  }
}
