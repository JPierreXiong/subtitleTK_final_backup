import { NextRequest } from 'next/server';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  createMediaTask,
  findMediaTaskById,
  updateMediaTaskById,
} from '@/shared/models/media_task';
import { getUuid } from '@/shared/lib/hash';
import { fetchMediaFromRapidAPI } from '@/shared/services/media/rapidapi';
import {
  uploadVideoToStorage,
  uploadVideoToR2,
} from '@/shared/services/media/video-storage';
import {
  consumeCredits,
  CreditTransactionScene,
  CreditTransactionType,
  getRemainingCredits,
} from '@/shared/models/credit';
import {
  checkAllPlanLimits,
  getEstimatedCreditsCost,
  getUserPlanLimits,
} from '@/shared/services/media/plan-limits';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Process media task asynchronously
 * This function runs in the background and updates task status
 */
async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  try {
    // Credits are already consumed in createMediaTask
    // No need to consume again here

    // Update status to processing
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 10,
    });

    // Step 1: Fetch media data from RapidAPI
    // Pass outputType to ensure correct API is called
    const mediaData = await fetchMediaFromRapidAPI(url, outputType || 'subtitle');

    // Update progress
    await updateMediaTaskById(taskId, {
      progress: 30,
      platform: mediaData.platform,
      title: mediaData.title,
      author: mediaData.author,
      likes: mediaData.likes,
      views: mediaData.views,
      shares: mediaData.shares,
      duration: mediaData.duration,
      publishedAt: mediaData.publishedAt,
      thumbnailUrl: mediaData.thumbnailUrl,
      sourceLang: mediaData.sourceLang || 'auto',
    });

    // Step 2: Handle video upload if needed (TikTok + video output type)
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;

    if (
      mediaData.platform === 'tiktok' &&
      outputType === 'video' &&
      mediaData.videoUrl &&
      mediaData.isTikTokVideo
    ) {
      await updateMediaTaskById(taskId, {
        progress: 40,
      });

      // Try to upload video to storage (R2 or Vercel Blob)
      const storageIdentifier = await uploadVideoToStorage(mediaData.videoUrl);

      if (storageIdentifier) {
        // Successfully uploaded to storage
        videoUrlInternal = storageIdentifier;
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await updateMediaTaskById(taskId, {
          progress: 70,
        });
      } else {
        // Storage not configured or upload failed, use original video URL
        // Store original URL with a special prefix to indicate it's not in storage
        videoUrlInternal = `original:${mediaData.videoUrl}`;
        // Note: Original URLs from TikTok may expire, so set a shorter expiration
        expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for original URLs
        await updateMediaTaskById(taskId, {
          progress: 70,
        });
        console.log(
          'Using original video URL (storage not configured or upload failed)'
        );
      }
    }

    // Step 3: Save subtitle content
    await updateMediaTaskById(taskId, {
      progress: 90,
      subtitleRaw: mediaData.subtitleRaw || null,
    });

    // Step 4: Mark as extracted (ready for translation)
    await updateMediaTaskById(taskId, {
      status: 'extracted',
      progress: 100,
      videoUrlInternal: videoUrlInternal,
      expiresAt: expiresAt,
    });
  } catch (error: any) {
    console.error('Media task processing failed:', error);
    // Get task to retrieve creditId for refund
    const failedTask = await findMediaTaskById(taskId);
    await updateMediaTaskById(taskId, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error occurred',
      progress: 0,
      creditId: failedTask?.creditId || null, // Ensure creditId is passed for refund
    });
  }
}

/**
 * POST /api/media/submit
 * Submit a new media extraction task
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, outputType, targetLang } = body;

    // Validation
    if (!url || typeof url !== 'string') {
      return respErr('URL is required');
    }

    // Validate URL format (supports YouTube Shorts)
    const isValidUrl =
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('tiktok.com') ||
      url.includes('vm.tiktok.com');

    if (!isValidUrl) {
      return respErr('Invalid URL. Please provide a YouTube or TikTok URL.');
    }

    // Validate output type
    if (outputType && outputType !== 'subtitle' && outputType !== 'video') {
      return respErr('Invalid output type. Must be "subtitle" or "video".');
    }

    // Both TikTok and YouTube support video download now
    // No need to restrict video download to TikTok only

    // Get current user
    const currentUser = await getUserInfo();
    if (!currentUser) {
      return respErr('no auth, please sign in');
    }

    // Calculate required credits
    // Video download only: 15 credits (no subtitle extraction charge)
    // Subtitle extraction only: 10 credits
    let requiredCredits = outputType === 'video' ? 15 : 10;

    // Check plan limits (including free trial availability)
    const planLimitsCheck = await checkAllPlanLimits({
      userId: currentUser.id,
      outputType: outputType || 'subtitle',
    });

    // If there are blocking errors, return them
    if (!planLimitsCheck.allowed) {
      return respErr(planLimitsCheck.errors.join('; '));
    }

    // Check credits BEFORE creating task (immediate feedback)
    const remainingCredits = await getRemainingCredits(currentUser.id);
    
    // Determine if we should use free trial
    // Use free trial if:
    // 1. Free trial is available AND
    // 2. User doesn't have enough credits OR user explicitly wants to use free trial
    const useFreeTrial = planLimitsCheck.freeTrialAvailable && remainingCredits < requiredCredits;

    // If not using free trial and credits are insufficient, return error
    if (!useFreeTrial && remainingCredits < requiredCredits) {
      return respErr(
        `Insufficient credits. Required: ${requiredCredits}, Available: ${remainingCredits}`
      );
    }

    // Create media task
    const taskId = getUuid();
    const newTask = {
      id: taskId,
      userId: currentUser.id,
      platform: url.includes('tiktok') ? 'tiktok' : 'youtube',
      videoUrl: url,
      outputType: outputType || 'subtitle',
      targetLang: targetLang || null,
      status: 'pending' as const,
      progress: 0,
      isFreeTrial: useFreeTrial, // Mark as free trial if applicable
    };

    // Create task and consume credits (if not free trial)
    if (useFreeTrial) {
      // Create task without consuming credits
      await createMediaTask(newTask, 0);
      
      // Update free trial count
      const limits = await getUserPlanLimits(currentUser.id);
      const currentFreeTrialUsed = limits.freeTrialUsed || 0;
      
      await db()
        .update(user)
        .set({ freeTrialUsed: currentFreeTrialUsed + 1 })
        .where(eq(user.id, currentUser.id));
    } else {
      // Create task and consume credits (in transaction)
      await createMediaTask(newTask, requiredCredits);
    }

    // Start async processing (don't await - let it run in background)
    // Note: In serverless environments, background tasks may be terminated
    // Frontend will poll /api/media/status to check task progress
    processMediaTask(
      taskId,
      url,
      outputType || 'subtitle',
      currentUser.id
    ).catch(async (error) => {
      console.error('Background task failed:', error);
      // Update task status to failed if background task fails
      // Get task to retrieve creditId for refund
      const failedTask = await findMediaTaskById(taskId);
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message || 'Background processing failed',
        progress: 0,
        creditId: failedTask?.creditId || null, // Ensure creditId is passed for refund
      }).catch((updateError) => {
        console.error('Failed to update task status:', updateError);
      });
    });

    // Immediately return task ID
    return respData({
      taskId: taskId,
      message: 'Task submitted successfully',
    });
  } catch (error: any) {
    console.error('Media submit failed:', error);
    return respErr(error.message || 'Failed to submit media task');
  }
}
