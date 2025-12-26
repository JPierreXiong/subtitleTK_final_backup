import { NextRequest, NextResponse } from 'next/server';
import { getUserInfo } from '@/shared/models/user';
import { findMediaTaskById } from '@/shared/models/media_task';
import { getVideoDownloadUrl } from '@/shared/services/media/video-storage';

// Set max duration for video downloads (3 minutes)
export const maxDuration = 180;

/**
 * GET /api/media/download-proxy
 * Proxy download for video files (handles Vercel Blob, R2, and original URLs)
 * Uses streaming to handle large files efficiently
 * This ensures proper Content-Disposition headers and avoids CORS issues
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find task
    const task = await findMediaTaskById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check permission
    if (task.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if video exists
    if (!task.videoUrlInternal) {
      return NextResponse.json(
        { error: 'Video not available' },
        { status: 404 }
      );
    }

    // Get the actual download URL
    let downloadUrl: string;

    try {
      // Use getVideoDownloadUrl for all storage formats (including original:)
      // This ensures consistent URL parsing logic
      downloadUrl = await getVideoDownloadUrl(task.videoUrlInternal);
    } catch (urlError: any) {
      console.error('Failed to get download URL:', urlError);
      return NextResponse.json(
        { error: `Failed to get download URL: ${urlError.message}` },
        { status: 500 }
      );
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Download URL is empty' },
        { status: 500 }
      );
    }

    // Validate URL format
    try {
      new URL(downloadUrl);
    } catch (urlError) {
      return NextResponse.json(
        { error: `Invalid download URL format: ${downloadUrl}` },
        { status: 500 }
      );
    }

    // Fetch the video file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout

    try {
      const videoResponse = await fetch(downloadUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!videoResponse.ok) {
        const errorText = await videoResponse.text().catch(() => 'Unknown error');
        console.error(
          `Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`,
          errorText
        );
        return NextResponse.json(
          {
            error: `Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`,
          },
          { status: videoResponse.status }
        );
      }

      // Check if response has a body
      if (!videoResponse.body) {
        return NextResponse.json(
          { error: 'Video file has no content' },
          { status: 500 }
        );
      }

      // Extract filename from URL or use default
      let filename = `video-${taskId}.mp4`;
      try {
        const urlObj = new URL(downloadUrl);
        const urlPath = urlObj.pathname;
        const extractedFilename = urlPath.split('/').pop();
        if (extractedFilename && extractedFilename.includes('.')) {
          filename = extractedFilename;
        }
      } catch (e) {
        // Use default filename if URL parsing fails
        console.warn('Failed to extract filename from URL:', e);
      }

      // Stream the video response directly to client
      // This avoids loading the entire file into memory
      const headers = new Headers();
      headers.set('Content-Type', videoResponse.headers.get('Content-Type') || 'video/mp4');
      headers.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      
      // Only set Content-Length if available
      const contentLength = videoResponse.headers.get('Content-Length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }
      
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');

      return new NextResponse(videoResponse.body, {
        headers,
        status: 200,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Download timeout. The video file may be too large.' },
          { status: 504 }
        );
      }

      console.error('Video fetch error:', fetchError);
      return NextResponse.json(
        {
          error: `Failed to download video: ${fetchError.message || 'Unknown error'}`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Download proxy error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Download failed',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

