/**
 * Video Download Service
 * Handles reliable video download with retry and timeout
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp';

/**
 * Download video from URL to local file
 * @param videoUrl Video URL to download
 * @param taskId Task ID for file naming
 * @returns Path to downloaded video file
 */
export async function downloadVideo(
  videoUrl: string,
  taskId: string
): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${taskId}-video.mp4`);
  const controller = new AbortController();

  // Timeout: 60 seconds
  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  try {
    console.log(`[Download Video] Starting download for task ${taskId}`, {
      videoUrl: videoUrl.substring(0, 100), // Log first 100 chars
      outputPath,
    });

    // Download video with timeout
    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Stream write to file
    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(response.body as any, fileStream);

    clearTimeout(timeout);

    // Verify file size
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    console.log(`[Download Video] Download completed for task ${taskId}`, {
      fileSize: stats.size,
      outputPath,
    });

    return outputPath;
  } catch (error: any) {
    clearTimeout(timeout);

    // Clean up failed file
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkError) {
        console.warn(`[Download Video] Failed to cleanup file ${outputPath}`, unlinkError);
      }
    }

    if (error.name === 'AbortError') {
      throw new Error('Download timeout: Request took longer than 60 seconds');
    }

    throw error;
  }
}

/**
 * Download video with retry mechanism
 * @param videoUrl Video URL to download
 * @param taskId Task ID for file naming
 * @param maxRetries Maximum number of retries (default: 3)
 * @returns Path to downloaded video file
 */
export async function downloadVideoWithRetry(
  videoUrl: string,
  taskId: string,
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[Download Video] Attempt ${attempt}/${maxRetries} for task ${taskId}`
      );
      return await downloadVideo(videoUrl, taskId);
    } catch (error: any) {
      lastError = error;
      console.error(
        `[Download Video] Attempt ${attempt}/${maxRetries} failed for task ${taskId}`,
        {
          error: error.message,
        }
      );

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(
          `[Download Video] Retrying in ${delay}ms for task ${taskId}`
        );
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `Download failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}



