/**
 * Storage Cleanup API
 * Handles cleanup of expired Vercel Blob files
 * Can be called manually or via Vercel Cron Job
 * 
 * Security: Should be protected in production (add authentication)
 */

import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { cleanupExpiredVideos, getStorageStats } from '@/shared/services/media/storage-cleanup';

/**
 * POST /api/media/cleanup-storage
 * Clean up expired video files from Vercel Blob
 * 
 * Optional query params:
 * - dryRun: If true, only return stats without deleting
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    if (dryRun) {
      // Dry run: Only return statistics
      const stats = await getStorageStats();
      return respData({
        dryRun: true,
        stats,
        message: 'Dry run completed. No files deleted.',
      });
    }

    // Actual cleanup
    const cleanedCount = await cleanupExpiredVideos();
    const stats = await getStorageStats();

    return respData({
      cleanedCount,
      stats,
      message: `Cleaned up ${cleanedCount} expired video files`,
    });
  } catch (error: any) {
    console.error('[Storage Cleanup API] Error:', error);
    return respErr(error.message || 'Failed to cleanup storage');
  }
}

/**
 * GET /api/media/cleanup-storage
 * Get storage statistics
 */
export async function GET() {
  try {
    const stats = await getStorageStats();
    return respData({
      stats,
      message: 'Storage statistics retrieved',
    });
  } catch (error: any) {
    console.error('[Storage Cleanup API] Error:', error);
    return respErr(error.message || 'Failed to get storage stats');
  }
}
