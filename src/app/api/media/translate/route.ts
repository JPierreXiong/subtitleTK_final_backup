import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  findMediaTaskById,
  updateMediaTaskById,
} from '@/shared/models/media_task';
import { translateSubtitleWithGemini } from '@/shared/services/media/gemini-translator';
import {
  consumeCredits,
  CreditTransactionScene,
  CreditTransactionType,
  getRemainingCredits,
} from '@/shared/models/credit';

/**
 * POST /api/media/translate
 * Translate subtitle for a media task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, targetLanguage } = body;

    // Validation
    if (!taskId) {
      return respErr('Task ID is required');
    }

    if (!targetLanguage) {
      return respErr('Target language is required');
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

    // Check task status
    if (task.status !== 'extracted') {
      return respErr(
        `Task is not ready for translation. Current status: ${task.status}`
      );
    }

    // Check if subtitle exists
    if (!task.subtitleRaw || task.subtitleRaw.trim().length === 0) {
      // Provide more helpful error message
      let errorMessage = 'No subtitle content to translate. ';
      if (task.status === 'extracted') {
        errorMessage += 'This video may not have subtitles available, or subtitle extraction failed.';
      } else {
        errorMessage += `Task status is ${task.status}. Please ensure the video extraction completed successfully.`;
      }
      return respErr(errorMessage);
    }

    // Check translation character limit
    const charCount = task.subtitleRaw.length;
    const { checkTranslationLimit, getEstimatedCreditsCost } = await import('@/shared/services/media/plan-limits');
    const translationCheck = await checkTranslationLimit(user.id, charCount);
    if (!translationCheck.allowed) {
      return respErr(translationCheck.reason || 'Translation character limit exceeded');
    }

    // Check if task is free trial (free trial tasks don't consume credits for translation either)
    const isFreeTrial = task.isFreeTrial || false;

    // Check credits (translation costs 5 credits)
    const requiredCredits = getEstimatedCreditsCost('subtitle', true) - getEstimatedCreditsCost('subtitle', false);
    if (!isFreeTrial) {
      const remainingCredits = await getRemainingCredits(user.id);
      if (remainingCredits < requiredCredits) {
        return respErr(
          `Insufficient credits for translation. Required: ${requiredCredits}, Available: ${remainingCredits}`
        );
      }
    }

    // Consume credits and save creditId (if not free trial)
    let consumedCredit = null;
    if (!isFreeTrial) {
      consumedCredit = await consumeCredits({
        userId: user.id,
        credits: requiredCredits,
        scene: CreditTransactionScene.PAYMENT,
        description: `Subtitle translation: ${targetLanguage}`,
        metadata: JSON.stringify({
          type: 'media-task-translation',
          taskId,
          targetLanguage,
        }),
      });
    }

    // Update status to translating and save creditId
    await updateMediaTaskById(taskId, {
      status: 'translating',
      targetLang: targetLanguage,
      progress: 0,
      creditId: consumedCredit?.id || null, // Save creditId for refund on failure (if not free trial)
    });

    try {
      // Translate subtitle
      const translatedSRT = await translateSubtitleWithGemini(
        task.subtitleRaw,
        targetLanguage
      );

      // Save translation result
      await updateMediaTaskById(taskId, {
        subtitleTranslated: translatedSRT,
        status: 'completed',
        progress: 100,
      });

      return respData({
        success: true,
        message: 'Translation completed successfully',
      });
    } catch (error: any) {
      // Update status to failed (will trigger credit refund in updateMediaTaskById)
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message || 'Translation failed',
        progress: 0,
        creditId: consumedCredit.id, // Ensure creditId is set for refund
      });

      throw error;
    }
  } catch (error: any) {
    console.error('Media translate failed:', error);
    return respErr(error.message || 'Failed to translate subtitle');
  }
}

