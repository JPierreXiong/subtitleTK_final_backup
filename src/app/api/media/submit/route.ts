import { NextRequest } from 'next/server';
import { waitUntil } from '@vercel/functions';

import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  createMediaTask,
  findMediaTaskById,
  updateMediaTaskById,
} from '@/shared/models/media_task';
import { getUuid } from '@/shared/lib/hash';
import { fetchMediaFromRapidAPI } from '@/shared/services/media/rapidapi';
import type { NormalizedMediaData } from '@/extensions/media';
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
import { sendTaskHeartbeat } from '@/shared/utils/task-heartbeat';

/**
 * Configure max duration for this route
 * This allows waitUntil to have sufficient time to complete long-running tasks
 * Note: Vercel Free tier has 10s limit (cannot be overridden)
 * Vercel Pro tier supports up to 300s (5 minutes)
 * The actual limit is also configured in vercel.json
 */
export const maxDuration = 180; // 3 minutes (for Vercel Pro tier)

/**
 * Trigger internal processing endpoint
 * This is more reliable than setTimeout in Vercel Serverless environment
 * The internal endpoint runs in a separate instance and can have longer timeout
 */
async function triggerInternalProcessing(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
): Promise<void> {
  try {
    // Get the site URL (for internal API calls)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 
                    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                    'http://localhost:3000';
    
    // Trigger internal processing endpoint (don't await to avoid blocking)
    // This endpoint runs in a separate instance and can handle longer tasks
    fetch(`${siteUrl}/api/media/process-internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Optional: Add internal auth header for security
        // 'X-Internal-Auth': process.env.INTERNAL_AUTH_TOKEN || '',
      },
      body: JSON.stringify({
        taskId,
        url,
        outputType,
        userId,
      }),
    }).catch(async (fetchError: any) => {
      // If internal endpoint trigger fails, use setTimeout as last resort
      console.error('[Internal Processing Trigger Failed]', {
        taskId,
        error: fetchError.message,
      });
      console.log(`[Fallback] Using setTimeout for task ${taskId}`);
      
      setTimeout(() => {
        processMediaTask(taskId, url, outputType, userId).catch(async (error) => {
          console.error('[Background Task Failed]', {
            taskId,
            url,
            outputType,
            error: error.message,
            stack: error.stack,
          });
          
          try {
            const failedTask = await findMediaTaskById(taskId);
            await updateMediaTaskById(taskId, {
              status: 'failed',
              errorMessage: error.message || 'Background processing failed',
              progress: 0,
              creditId: failedTask?.creditId || null,
            });
            console.log(`[Task Updated] Task ${taskId} marked as failed, refund should be triggered`);
          } catch (updateError: any) {
            console.error('[Failed to Update Task Status]', {
              taskId,
              updateError: updateError.message,
            });
          }
        });
      }, 100); // Defer by 100ms to ensure response is sent first
    });
  } catch (error: any) {
    // If trigger function itself fails, use setTimeout as last resort
    console.error('[Trigger Internal Processing Failed]', {
      taskId,
      error: error.message,
    });
    
    setTimeout(() => {
      processMediaTask(taskId, url, outputType, userId).catch(async (error) => {
        console.error('[Background Task Failed]', {
          taskId,
          url,
          outputType,
          error: error.message,
          stack: error.stack,
        });
        
        try {
          const failedTask = await findMediaTaskById(taskId);
          await updateMediaTaskById(taskId, {
            status: 'failed',
            errorMessage: error.message || 'Background processing failed',
            progress: 0,
            creditId: failedTask?.creditId || null,
          });
          console.log(`[Task Updated] Task ${taskId} marked as failed, refund should be triggered`);
        } catch (updateError: any) {
          console.error('[Failed to Update Task Status]', {
            taskId,
            updateError: updateError.message,
          });
        }
      });
    }, 100);
  }
}

/**
 * Process media task asynchronously
 * This function runs in the background and updates task status
 * Exported for use in internal processing endpoint
 */
export async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  try {
    // Credits are already consumed in createMediaTask
    // No need to consume again here

    // Update status to processing
    // updated_at will be automatically updated (ShipAny behavior)
    // Watchdog uses updated_at to detect timeout (soft constraint, no schema change)
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
          // 💓 Heartbeat: Video upload can take time, send heartbeat
          await sendTaskHeartbeat(taskId, 50);
          
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
    
    // 💓 Heartbeat: Send heartbeat before long-running API call
    // This prevents watchdog from killing tasks that are actually running
    await sendTaskHeartbeat(taskId, 20); // Update progress to 20, heartbeat updated_at

    // Add overall timeout protection
    // Note: Since we use waitUntil for async processing, we can use longer timeout
    // vercel.json configures maxDuration: 180s for media APIs
    // Set timeout to 25 seconds to allow RapidAPI enough time while staying safe
    const API_CALL_TIMEOUT = 25000; // 25 seconds (allows RapidAPI more time to respond)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API call timeout: Request took longer than 25 seconds. The video may be too long or the API is slow. Please try again.'));
      }, API_CALL_TIMEOUT);
    });
    
    let mediaData: NormalizedMediaData;
    try {
      mediaData = await Promise.race([
        fetchMediaFromRapidAPI(url, outputType || 'subtitle'),
        timeoutPromise,
      ]);
    } catch (error: any) {
      // Handle timeout with better error message
      if (error.message?.includes('timeout')) {
        console.error(`[Process Task] API timeout for ${url}:`, error.message);
        await updateMediaTaskById(taskId, {
          status: 'failed',
          errorMessage: `API timeout: ${error.message}. This may happen with long videos or slow API responses. Please try again or use a shorter video.`,
          progress: 0,
        });
        throw error;
      }
      throw error;
    }

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
    // ⚠️ 关键：使用 sanitizer 清理数据，防止数据库更新失败
    const { sanitizeMediaTaskUpdate } = await import('@/shared/utils/media-data-sanitizer');
    
    try {
      const sanitizedData = sanitizeMediaTaskUpdate({
        progress: 30,
        platform: mediaData.platform,
        title: mediaData.title,
        author: mediaData.author,
        likes: mediaData.likes,
        views: mediaData.views,
        shares: mediaData.shares,
        duration: mediaData.duration, // 可能是 "00:28" 格式，需要转换为秒数
        publishedAt: mediaData.publishedAt,
        thumbnailUrl: mediaData.thumbnailUrl,
        sourceLang: mediaData.sourceLang || 'auto',
      });

      await updateMediaTaskById(taskId, sanitizedData);
    } catch (updateError: any) {
      // ⚠️ 关键：如果 metadata 更新失败，标记任务为 failed 并触发退款
      console.error('[Metadata Update Failed]', {
        taskId,
        error: updateError.message,
        stack: updateError.stack,
        mediaData: {
          duration: mediaData.duration,
          thumbnailUrl: mediaData.thumbnailUrl?.substring(0, 100), // Log first 100 chars
        },
      });

      // Get task to retrieve creditId for refund
      try {
        const failedTask = await findMediaTaskById(taskId);
        await updateMediaTaskById(taskId, {
          status: 'failed',
          errorMessage: `Metadata update failed: ${updateError.message}`,
          progress: 0,
          creditId: failedTask?.creditId || null,
        });
        console.log(`[Task Updated] Task ${taskId} marked as failed due to metadata update error`);
      } catch (markFailedError: any) {
        console.error('[Failed to Mark Task as Failed]', {
          taskId,
          error: markFailedError.message,
        });
      }

      // Re-throw to stop processing
      throw updateError;
    }

    // 💓 Heartbeat: Send heartbeat after metadata update
    // Long-running video upload operations need heartbeat
    await sendTaskHeartbeat(taskId, 40);

    // Step 3: Handle video upload if needed (TikTok + video output type)
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;

    if (
      outputType === 'video' &&
      mediaData.videoUrl
    ) {

      if (mediaData.platform === 'tiktok' && mediaData.isTikTokVideo) {
        // 💓 Heartbeat: Video upload can take time, send heartbeat
        await sendTaskHeartbeat(taskId, 50);
        
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
    console.error('[Media Task Processing Failed]', {
      taskId,
      url,
      outputType,
      error: error.message,
      errorName: error.name,
      stack: error.stack,
    });
    
    // Get task to retrieve creditId for refund
    try {
      const failedTask = await findMediaTaskById(taskId);
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message || 'Unknown error occurred',
        progress: 0,
        creditId: failedTask?.creditId || null, // Ensure creditId is passed for refund
      });
      console.log(`[Task Updated] Task ${taskId} marked as failed, refund should be triggered`);
    } catch (updateError: any) {
      console.error('[Failed to Update Task Status]', {
        taskId,
        updateError: updateError.message,
      });
    }
  }
}

/**
 * POST /api/media/submit
 * Submit a new media extraction task
 * 
 * Note: maxDuration is configured in vercel.json (180 seconds for media APIs)
 * This allows waitUntil to have sufficient time to complete long-running tasks
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

    // 🎯 P-1: Cache Hit Check - Check for completed tasks with same URL within 24 hours
    // This can save significant RapidAPI costs for popular videos
    // Strategy: Find completed tasks with same URL and outputType, reuse their data
    try {
      const { findCachedTask } = await import('@/shared/services/media/task-cache');
      const cachedTask = await findCachedTask(url.trim(), outputType || 'subtitle');

      if (cachedTask) {
        console.log(`[Task Cache] Hit for URL: ${url.substring(0, 100)}... (outputType: ${outputType})`);
        
        // Create a new task record with cached data (no API call, no credit consumption for processing)
        // User still needs to pay for the task, but we skip RapidAPI and processing
        const taskId = getUuid();
        const cachedTaskRecord = {
          id: taskId,
          userId: currentUser.id,
          platform: cachedTask.platform as 'youtube' | 'tiktok',
          videoUrl: url.trim(),
          outputType: outputType || 'subtitle',
          targetLang: targetLang || null,
          status: 'extracted' as const, // Directly mark as extracted (ready for translation)
          progress: 100,
          // Copy cached metadata
          title: cachedTask.title,
          author: cachedTask.author,
          thumbnailUrl: cachedTask.thumbnailUrl,
          duration: cachedTask.duration,
          likes: cachedTask.likes,
          views: cachedTask.views,
          shares: cachedTask.shares,
          publishedAt: cachedTask.publishedAt,
          sourceLang: cachedTask.sourceLang,
          // Copy cached results
          subtitleRaw: cachedTask.subtitleRaw,
          subtitleTranslated: cachedTask.subtitleTranslated,
          videoUrlInternal: cachedTask.videoUrlInternal,
          expiresAt: cachedTask.expiresAt,
          isFreeTrial: false, // Cached tasks are not free trials
        };

        // Calculate required credits for cached task (same as normal task)
        const cachedRequiredCredits = outputType === 'video' ? 15 : 10;
        
        // Create task (still consume credits, but no processing cost)
        // For cached tasks, we can optionally reduce credit cost, but for now keep it same
        await createMediaTask(cachedTaskRecord, cachedRequiredCredits);

        console.log(`[Task Cache] Created cached task ${taskId} from cache ${cachedTask.id}`);

        // Return immediately with completed status
        return respData({
          taskId: taskId,
          message: 'Task completed from cache (no API call needed)',
          isCached: true, // Flag to indicate this was from cache
        });
      }
    } catch (cacheError: any) {
      // If cache check fails, log but continue with normal flow
      console.warn('[Task Cache] Cache check failed, continuing with normal flow', {
        error: cacheError.message,
      });
    }

    // ❌ Cache miss: Continue with normal processing flow
    console.log(`[Task Cache] Miss for URL: ${url.substring(0, 100)}... (outputType: ${outputType})`);

    // Calculate required credits
    // Video download only: 15 credits (no subtitle extraction charge)
    // Subtitle extraction only: 10 credits
    let requiredCredits = outputType === 'video' ? 15 : 10;

    // 🛡 Watchdog: Mark timeout tasks BEFORE checking concurrent limit
    // This ensures failed/timeout tasks don't block new submissions
    try {
      const { markTimeoutTasks } = await import('@/shared/models/media_task_watchdog');
      const timeoutCount = await markTimeoutTasks();
      if (timeoutCount > 0) {
        console.log(`[Watchdog] Marked ${timeoutCount} timeout tasks before submission`);
      }
    } catch (watchdogError: any) {
      // Don't fail the request if watchdog fails, just log it
      console.error('[Watchdog Error]', watchdogError.message);
    }

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

    // Start async processing with multi-layer fallback strategy
    // Priority 0 (P0): waitUntil - Native Vercel solution, zero cost, best performance
    // Priority 1 (P1): Worker/Queue (QStash) - Most reliable for high concurrency
    // Priority 2 (P2): Internal processing endpoint - More reliable than setTimeout
    // Priority 3 (P3): setTimeout - Last resort fallback
    
    // P0: Try waitUntil first (native Vercel solution)
    // waitUntil ensures the task continues executing even after response is sent
    // It runs in the same request context, sharing cookies/auth automatically
    try {
      waitUntil(
        processMediaTask(taskId, url, outputType || 'subtitle', currentUser.id)
          .then(() => {
            console.log(`[waitUntil] Task ${taskId} completed successfully`);
          })
          .catch(async (error: any) => {
            console.error('[waitUntil] Task processing failed', {
              taskId,
              error: error.message,
              stack: error.stack,
            });
            // Error handling is done inside processMediaTask
            // This catch is just for logging
          })
      );
      console.log(`[waitUntil] Task ${taskId} processing started via waitUntil`);
    } catch (waitUntilError: any) {
      // If waitUntil is not available or fails, fallback to other strategies
      console.warn('[waitUntil] Not available or failed, using fallback', {
        taskId,
        error: waitUntilError.message,
      });
      
      // P1: Fallback to Worker/Queue (QStash) if enabled
      const { isWorkerEnabled, enqueueMediaTask } = await import('@/shared/services/queue/qstash');
      
      if (isWorkerEnabled()) {
        try {
          await enqueueMediaTask(
            taskId,
            url,
            outputType || 'subtitle',
            currentUser.id
          );
          console.log(`[Queue] Task ${taskId} enqueued to Worker`);
        } catch (queueError: any) {
          console.error('[Queue Error]', {
            taskId,
            error: queueError.message,
          });
          // P2: Fallback to internal processing endpoint
          await triggerInternalProcessing(taskId, url, outputType || 'subtitle', currentUser.id);
        }
      } else {
        // P2: Use internal processing endpoint (more reliable than setTimeout)
        await triggerInternalProcessing(taskId, url, outputType || 'subtitle', currentUser.id);
      }
    }

    // Immediately return task ID (202 Accepted for async processing)
    return Response.json(
      {
        code: 0,
        message: 'Task submitted successfully',
        data: { taskId: taskId },
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('Media submit failed:', error);
    return respErr(error.message || 'Failed to submit media task');
  }
}
