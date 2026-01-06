/**
 * Video Storage Service
 * Handles video upload to Vercel Blob storage for media tasks
 * Falls back to original video URL if Vercel Blob is not configured or upload fails
 */

import { getStorageService } from '@/shared/services/storage';
import { nanoid } from 'nanoid';
import { R2Provider, VercelBlobProvider } from '@/extensions/storage';

/**
 * Upload video from URL to storage (Vercel Blob only)
 * @param videoUrl Video URL (from RapidAPI)
 * @returns Storage identifier (full URL for Vercel Blob) or null to use original URL
 */
export async function uploadVideoToStorage(
  videoUrl: string
): Promise<string | null> {
  const storageService = await getStorageService();

  // Try Vercel Blob (if configured)
  const vercelBlobProvider = storageService.getProvider(
    'vercel-blob'
  ) as VercelBlobProvider;
  if (vercelBlobProvider) {
    try {
      // Generate unique key
      const key = `videos/${nanoid()}-${Date.now()}.mp4`;

      // Stream upload video
      const result = await vercelBlobProvider.streamUploadFromUrl(
        videoUrl,
        key,
        'video/mp4'
      );

      if (result.success && result.url) {
        // Vercel Blob returns full URL, store it with a prefix to identify it
        return `vercel-blob:${result.url}`;
      } else {
        console.warn(
          'Failed to upload video to Vercel Blob:',
          result.error
        );
      }
    } catch (error: any) {
      console.warn('Vercel Blob upload error:', error.message);
    }
  }

  // Vercel Blob not configured or upload failed, use original URL
  console.warn(
    'Vercel Blob not configured or upload failed. Using original video URL.'
  );
  return null;
}

/**
 * Upload video from URL to R2 storage (backward compatibility)
 * @deprecated Use uploadVideoToStorage instead
 */
export async function uploadVideoToR2(videoUrl: string): Promise<string | null> {
  return uploadVideoToStorage(videoUrl);
}

/**
 * Get download URL for video
 * @param storageIdentifier Storage identifier (format: "provider:key" or "provider:url")
 * @param expiresIn Expiration time in seconds (default: 86400 = 24 hours, ignored for Vercel Blob)
 * @returns Download URL
 */
export async function getVideoDownloadUrl(
  storageIdentifier: string,
  expiresIn: number = 86400
): Promise<string> {
  const storageService = await getStorageService();

  // Parse storage identifier - use indexOf to handle URLs with multiple colons (e.g., https://)
  // Fix: split(':', 2) would truncate "vercel-blob:https://..." to ["vercel-blob", "https"]
  const colonIndex = storageIdentifier.indexOf(':');
  
  if (colonIndex === -1) {
    // No prefix, assume it's a legacy format (R2 key)
    const r2Provider = storageService.getProvider('r2') as R2Provider;
    if (r2Provider) {
      return await r2Provider.getPresignedUrl(storageIdentifier, expiresIn);
    }
    throw new Error('Storage provider not configured');
  }

  const provider = storageIdentifier.substring(0, colonIndex);
  const identifier = storageIdentifier.substring(colonIndex + 1); // Get everything after the first colon

  if (provider === 'vercel-blob') {
    // Vercel Blob: identifier is the full URL, return it directly
    return identifier;
  } else if (provider === 'r2') {
    // R2: identifier is the key, generate presigned URL
    const r2Provider = storageService.getProvider('r2') as R2Provider;
    if (!r2Provider) {
      throw new Error('R2 storage provider is not configured');
    }
    return await r2Provider.getPresignedUrl(identifier, expiresIn);
  } else if (provider === 'original') {
    // Original URL (fallback when storage is not configured)
    return identifier;
  } else {
    // Legacy format: assume it's an R2 key
    const r2Provider = storageService.getProvider('r2') as R2Provider;
    if (r2Provider) {
      return await r2Provider.getPresignedUrl(storageIdentifier, expiresIn);
    }
    throw new Error('Storage provider not configured');
  }
}


