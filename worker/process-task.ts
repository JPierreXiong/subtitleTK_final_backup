/**
 * Media Task Processing
 * Core logic for processing media tasks
 */

import { updateMediaTaskById, findMediaTaskById } from '../src/shared/models/media_task';
import { fetchMediaFromRapidAPI } from '../src/shared/services/media/rapidapi';
import { sendTaskHeartbeat } from '../src/shared/utils/task-heartbeat';
import { downloadVideoWithRetry } from './download-video';
import { extractAudio } from './extract-audio';
import { formatSubtitlesToSRT, parseRapidAPISubtitle } from './transcribe';
import { cleanupTempFiles } from './cleanup';

/**
 * Process media task
 * This is the main processing function that runs in the Worker
 */
export async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  console.log(`[Process Task] Starting task ${taskId}`, {
    url,
    outputType,
    userId,
    timestamp: new Date().toISOString(),
  });

  try {
    // Step 0: Update status to processing
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 10,
    });
    console.log(`[Process Task] Task ${taskId} status updated to processing`);

    // Step 1: Fetch media info from RapidAPI
    await sendTaskHeartbeat(taskId, 20);
    console.log(`[Process Task] Fetching media info from RapidAPI for ${url}`);

    const mediaInfo = await fetchMediaFromRapidAPI(url, outputType);

    // Update metadata
    const { sanitizeMediaTaskUpdate } = await import('../src/shared/utils/media-data-sanitizer');
    const sanitizedData = sanitizeMediaTaskUpdate({
      progress: 30,
      platform: mediaInfo.platform,
      title: mediaInfo.title,
      author: mediaInfo.author,
      likes: mediaInfo.likes,
      views: mediaInfo.views,
      shares: mediaInfo.shares,
      duration: mediaInfo.duration,
      publishedAt: mediaInfo.publishedAt,
      thumbnailUrl: mediaInfo.thumbnailUrl,
      sourceLang: mediaInfo.sourceLang || 'auto',
    });

    await updateMediaTaskById(taskId, sanitizedData);
    await sendTaskHeartbeat(taskId, 40);
    console.log(`[Process Task] Media info fetched and saved for task ${taskId}`);

    // Step 2: Process video and extract subtitles
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;
    let videoPath: string | null = null;
    let audioPath: string | null = null;
    let subtitleRaw: string | null = null;

    // Priority: Use RapidAPI subtitle if available
    if (mediaInfo.subtitleRaw) {
      console.log(`[Process Task] Using RapidAPI subtitle for task ${taskId}`);
      subtitleRaw = mediaInfo.subtitleRaw;
    } else if (outputType === 'subtitle' && mediaInfo.videoUrl) {
      // If no subtitle from RapidAPI, download video and extract audio for ASR
      console.log(`[Process Task] No subtitle from RapidAPI, downloading video for ASR`);
      await sendTaskHeartbeat(taskId, 50);

      try {
        // Download video
        videoPath = await downloadVideoWithRetry(mediaInfo.videoUrl, taskId);
        console.log(`[Process Task] Video downloaded for task ${taskId}`);

        // Extract audio
        await sendTaskHeartbeat(taskId, 60);
        audioPath = await extractAudio(videoPath, taskId);
        console.log(`[Process Task] Audio extracted for task ${taskId}`);

        // TODO: Use cloud ASR API if needed
        // For now, if RapidAPI doesn't provide subtitle, we mark it as failed
        throw new Error('No subtitle available from RapidAPI and cloud ASR not configured');
      } catch (error: any) {
        console.error(`[Process Task] Failed to extract subtitle for task ${taskId}`, {
          error: error.message,
        });
        // Clean up temp files
        await cleanupTempFiles([videoPath, audioPath].filter(Boolean) as string[]);
        throw error;
      }
    }

    // Step 3: Handle video download (if outputType is 'video')
    if (outputType === 'video' && mediaInfo.videoUrl) {
      console.log(`[Process Task] Starting video download for task ${taskId}`);
      await sendTaskHeartbeat(taskId, 50);

      try {
        // Download video
        videoPath = await downloadVideoWithRetry(mediaInfo.videoUrl, taskId);
        console.log(`[Process Task] Video downloaded for task ${taskId}`);

        // TODO: Upload to storage
        // For now, use original URL as fallback
        videoUrlInternal = `original:${mediaInfo.videoUrl}`;
        expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        console.log(`[Process Task] Using original video URL for task ${taskId}`);

        // Clean up downloaded file (we're using original URL)
        await cleanupTempFiles([videoPath]);
        videoPath = null;
      } catch (error: any) {
        console.error(`[Process Task] Video download failed for task ${taskId}`, {
          error: error.message,
        });
        // Clean up temp files
        await cleanupTempFiles([videoPath].filter(Boolean) as string[]);
        throw error;
      }
    }

    // Step 4: Save subtitle content
    await sendTaskHeartbeat(taskId, 80);
    await updateMediaTaskById(taskId, {
      progress: 90,
      subtitleRaw: subtitleRaw || null,
    });
    console.log(`[Process Task] Subtitle saved for task ${taskId}`);

    // Step 5: Clean up temporary files
    await cleanupTempFiles([videoPath, audioPath].filter(Boolean) as string[]);

    // Step 6: Mark as extracted
    await updateMediaTaskById(taskId, {
      status: 'extracted',
      progress: 100,
      videoUrlInternal: videoUrlInternal,
      expiresAt: expiresAt,
    });

    console.log(`[Process Task] Task ${taskId} completed successfully`);
  } catch (error: any) {
    console.error(`[Process Task] Task ${taskId} failed`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Clean up temporary files on error
    // Note: videoPath and audioPath are in the outer scope, but may not be defined
    // We'll try to clean up any temp files that might exist
    try {
      const tempDir = process.env.TEMP_DIR || '/tmp';
      const tempFiles = [
        `${tempDir}/${taskId}-video.mp4`,
        `${tempDir}/${taskId}-audio.wav`,
      ];
      await cleanupTempFiles(tempFiles);
    } catch (cleanupError) {
      console.warn(`[Process Task] Failed to cleanup temp files for task ${taskId}`, cleanupError);
    }

    // Update status to failed (will trigger refund)
    try {
      const failedTask = await findMediaTaskById(taskId);
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message || 'Unknown error occurred',
        progress: 0,
        creditId: failedTask?.creditId || null, // Ensure creditId is passed for refund
      });
      console.log(`[Process Task] Task ${taskId} marked as failed, refund should be triggered`);
    } catch (updateError: any) {
      console.error(`[Process Task] Failed to update task ${taskId} status`, {
        error: updateError.message,
        stack: updateError.stack,
      });
    }
  }
}

