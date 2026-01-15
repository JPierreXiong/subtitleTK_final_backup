/**
 * Process media task asynchronously
 * This function runs in the background and updates task status
 * Exported for use in internal processing endpoint
 * 
 * @param taskId - Task ID
 * @param url - Video URL
 * @param outputType - 'subtitle' | 'video'
 * @param userId - User ID
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

    // Add overall timeout protection (8 seconds max for Vercel Free tier)
    // Note: Individual API calls already have 8s timeout, this is a safety net
    const API_CALL_TIMEOUT = 8000; // 8 seconds (for Vercel Free tier)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API call timeout: Request took longer than 8 seconds'));
      }, API_CALL_TIMEOUT);
    });
    
    const mediaData = await Promise.race([
      fetchMediaFromRapidAPI(url, outputType || 'subtitle'),
      timeoutPromise,
    ]);

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
