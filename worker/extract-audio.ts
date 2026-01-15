/**
 * Audio Extraction Service
 * Extracts audio from video using ffmpeg
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const TEMP_DIR = process.env.TEMP_DIR || '/tmp';

/**
 * Extract audio from video file
 * @param videoPath Path to input video file
 * @param taskId Task ID for file naming
 * @returns Path to extracted audio file
 */
export async function extractAudio(
  videoPath: string,
  taskId: string
): Promise<string> {
  const audioPath = path.join(TEMP_DIR, `${taskId}-audio.wav`);

  // Verify input file exists
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  // ffmpeg command: extract audio, mono channel, 16kHz sample rate
  // -vn: disable video
  // -ac 1: mono audio
  // -ar 16000: 16kHz sample rate (optimal for ASR)
  // -y: overwrite output file
  const command = `ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -y "${audioPath}"`;

  try {
    console.log(`[Extract Audio] Starting audio extraction for task ${taskId}`, {
      videoPath,
      audioPath,
    });

    const { stdout, stderr } = await execAsync(command);

    // Log ffmpeg output (for debugging)
    if (stdout) {
      console.log(`[Extract Audio] ffmpeg stdout for task ${taskId}:`, stdout);
    }
    if (stderr) {
      console.log(`[Extract Audio] ffmpeg stderr for task ${taskId}:`, stderr);
    }

    // Verify output file exists
    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio extraction failed: file not created');
    }

    // Verify file size
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      throw new Error('Audio extraction failed: file is empty');
    }

    console.log(`[Extract Audio] Audio extraction completed for task ${taskId}`, {
      audioPath,
      fileSize: stats.size,
    });

    return audioPath;
  } catch (error: any) {
    console.error(`[Extract Audio] Audio extraction failed for task ${taskId}`, {
      error: error.message,
      stderr: error.stderr,
      stdout: error.stdout,
    });

    // Clean up failed file
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (unlinkError) {
        console.warn(
          `[Extract Audio] Failed to cleanup file ${audioPath}`,
          unlinkError
        );
      }
    }

    // Check if ffmpeg is available
    if (error.message.includes('ffmpeg') || error.message.includes('not found')) {
      throw new Error(
        'ffmpeg is not installed or not in PATH. Please install ffmpeg.'
      );
    }

    throw new Error(`Audio extraction failed: ${error.message}`);
  }
}

/**
 * Check if ffmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}



