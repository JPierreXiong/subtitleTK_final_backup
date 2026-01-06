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
import { generateVideoFingerprint } from '@/shared/lib/media-url';
import {
  findValidVideoCache,
  setVideoCache,
} from '@/shared/models/video_cache';

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

    // Step 1: Check cache for video download tasks (only for 'video' outputType)
    if (outputType === 'video') {
      const fingerprint = generateVideoFingerprint(url);
      const cached = await findValidVideoCache(fingerprint);
      
      if (cached) {
        // ✅ Cache hit: Completely skip API call
        console.log(`[Cache Hit] Skipping API call for ${url}, using cached download URL`);
        
        // Update progress
        await updateMediaTaskById(taskId, {
          progress: 30,
          platform: cached.platform,
          // Note: title, author, thumbnailUrl etc. are not set (remain NULL)
          // Frontend should handle NULL metadata gracefully
        });

        // Step 1.1: Handle video URL (use cached download URL)
        await updateMediaTaskById(taskId, {
          progress: 40,
        });

        // Determine platform-specific handling
        let videoUrlInternal: string | null = null;
        let expiresAt: Date | null = null;

        if (cached.platform === 'tiktok') {
          // TikTok: Try to upload video to storage (R2 or Vercel Blob)
          const storageIdentifier = await uploadVideoToStorage(cached.downloadUrl);

          if (storageIdentifier) {
            // Successfully uploaded to storage
            videoUrlInternal = storageIdentifier;
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            await updateMediaTaskById(taskId, {
              progress: 70,
            });
          } else {
            // Storage not configured or upload failed, use original video URL
            videoUrlInternal = `original:${cached.downloadUrl}`;
            expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for original URLs
            await updateMediaTaskById(taskId, {
              progress: 70,
            });
            console.log(
              'Using original video URL (storage not configured or upload failed)'
            );
          }
        } else if (cached.platform === 'youtube') {
          // YouTube: Use original video URL
          videoUrlInternal = `original:${cached.downloadUrl}`;
          expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for original URLs
          await updateMediaTaskById(taskId, {
            progress: 70,
          });
          console.log('Using cached YouTube video URL');
        }

        // Step 1.2: Mark as extracted (ready for download)
        // Note: subtitleRaw is not set (video download tasks don't need subtitles)
        await updateMediaTaskById(taskId, {
          status: 'extracted',
          progress: 100,
          videoUrlInternal: videoUrlInternal,
          expiresAt: expiresAt,
        });

        // ✅ Early return: Skip API call completely
        return;
      }
    }

    // ❌ Cache miss: Normal API call flow
    console.log(`[Cache Miss] Fetching from RapidAPI for ${url}`);
    const mediaData = await fetchMediaFromRapidAPI(url, outputType || 'subtitle');

    // Step 2: Cache the video download URL if this is a video task
    if (outputType === 'video' && mediaData.videoUrl) {
      const fingerprint = generateVideoFingerprint(url);
      // Set cache asynchronously (don't await to avoid blocking)
      setVideoCache(fingerprint, {
        originalUrl: url,
        downloadUrl: mediaData.videoUrl,
        platform: mediaData.platform,
        expiresInHours: 12, // Cache for 12 hours
      }).catch((error) => {
        console.error('Failed to cache video URL:', error);
        // Non-blocking: Continue even if cache fails
      });
    }

    // Update progress with metadata
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

    // Step 3: Handle video upload if needed (TikTok + video output type)
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;

    if (
      outputType === 'video' &&
      mediaData.videoUrl
    ) {
      await updateMediaTaskById(taskId, {
        progress: 40,
      });

      if (mediaData.platform === 'tiktok' && mediaData.isTikTokVideo) {
        // TikTok: Try to upload video to storage (R2 or Vercel Blob)
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
      } else if (mediaData.platform === 'youtube') {
        // YouTube: Use original video URL (YouTube videos are typically larger and may not need storage)
        // Store original URL with a special prefix to indicate it's not in storage
        videoUrlInternal = `original:${mediaData.videoUrl}`;
        // YouTube video URLs may expire, set expiration time
        expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours for original URLs
        await updateMediaTaskById(taskId, {
          progress: 70,
        });
        console.log('Using original YouTube video URL');
      }
    }

    // Step 4: Save subtitle content
    await updateMediaTaskById(taskId, {
      progress: 90,
      subtitleRaw: mediaData.subtitleRaw || null,
    });

    // Step 5: Mark as extracted (ready for translation)
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
