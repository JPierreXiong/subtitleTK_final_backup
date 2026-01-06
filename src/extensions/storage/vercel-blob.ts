import { put, del, head } from '@vercel/blob';
import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

/**
 * Vercel Blob storage provider configs
 * @docs https://vercel.com/docs/storage/vercel-blob
 */
export interface VercelBlobConfigs extends StorageConfigs {
  token?: string; // BLOB_READ_WRITE_TOKEN from environment variable
}

/**
 * Vercel Blob storage provider implementation
 * @website https://vercel.com/docs/storage/vercel-blob
 */
export class VercelBlobProvider implements StorageProvider {
  readonly name = 'vercel-blob';
  configs: VercelBlobConfigs;

  constructor(configs: VercelBlobConfigs = {}) {
    this.configs = {
      ...configs,
      token: configs.token || process.env.BLOB_READ_WRITE_TOKEN,
    };
  }

  /**
   * Upload file to Vercel Blob
   */
  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      if (!this.configs.token) {
        return {
          success: false,
          error: 'BLOB_READ_WRITE_TOKEN is required',
          provider: this.name,
        };
      }

      // Convert body to Blob for Vercel Blob API
      let blobBody: BlobPart | Uint8Array;
      if (options.body instanceof Buffer) {
        blobBody = new Uint8Array(options.body);
      } else if (options.body instanceof Uint8Array) {
        blobBody = options.body;
      } else {
        blobBody = options.body as BlobPart;
      }

      // @ts-ignore - Uint8Array is compatible with BlobPart in runtime
      const blob = new Blob([blobBody], {
        type: options.contentType || 'application/octet-stream',
      });

      // Upload to Vercel Blob
      const result = await put(options.key, blob, {
        access: 'public',
        contentType: options.contentType || 'application/octet-stream',
        addRandomSuffix: false, // Keep the custom key format
        token: this.configs.token,
      });

      return {
        success: true,
        location: result.url,
        key: options.key,
        filename: options.key.split('/').pop(),
        url: result.url,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  /**
   * Download from URL and upload to Vercel Blob
   */
  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      if (!this.configs.token) {
        return {
          success: false,
          error: 'BLOB_READ_WRITE_TOKEN is required',
          provider: this.name,
        };
      }

      // Fetch the file
      const response = await fetch(options.url);
      if (!response.ok) {
        return {
          success: false,
          error: `HTTP error! status: ${response.status}`,
          provider: this.name,
        };
      }

      if (!response.body) {
        return {
          success: false,
          error: 'No body in response',
          provider: this.name,
        };
      }

      // Convert response to Blob
      const blob = await response.blob();

      // Upload to Vercel Blob
      const result = await put(options.key, blob, {
        access: 'public',
        contentType: options.contentType || blob.type || 'application/octet-stream',
        addRandomSuffix: false,
        token: this.configs.token,
      });

      return {
        success: true,
        location: result.url,
        key: options.key,
        filename: options.key.split('/').pop(),
        url: result.url,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  /**
   * Stream upload from URL (for large video files)
   * Downloads video stream and uploads to Vercel Blob
   * Uses ReadableStream to avoid loading entire file into memory
   * @param videoUrl Video URL to download
   * @param key Storage key (e.g., 'videos/tiktok_12345.mp4')
   * @param contentType Content type (default: 'video/mp4')
   * @returns Storage upload result with key
   */
  async streamUploadFromUrl(
    videoUrl: string,
    key: string,
    contentType: string = 'video/mp4'
  ): Promise<StorageUploadResult> {
    try {
      if (!this.configs.token) {
        return {
          success: false,
          error: 'BLOB_READ_WRITE_TOKEN is required',
          provider: this.name,
        };
      }

      // Fetch video stream
      const response = await fetch(videoUrl, {
        signal: AbortSignal.timeout(60000), // 1 minute download timeout
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download video: ${response.status} ${response.statusText}`,
          provider: this.name,
        };
      }

      if (!response.body) {
        return {
          success: false,
          error: 'No body in response',
          provider: this.name,
        };
      }

      // Use ReadableStream directly if supported, otherwise convert to Blob
      // Vercel Blob's put() accepts ReadableStream, Blob, or Buffer
      let uploadBody: Blob | ReadableStream<Uint8Array>;
      
      // Try to use stream directly (more memory efficient)
      if (response.body instanceof ReadableStream) {
        uploadBody = response.body;
      } else {
        // Fallback: convert to Blob (may use more memory for large files)
        uploadBody = await response.blob();
      }

      // Extract filename and encode for safe contentDisposition header
      const fileName = key.split('/').pop() || 'video.mp4';
      const encodedFileName = encodeURIComponent(fileName);

      // Upload to Vercel Blob
      // Note: contentDisposition is not directly supported by @vercel/blob put()
      // We'll handle download headers in the download proxy API instead
      const result = await put(key, uploadBody, {
        access: 'public',
        contentType: contentType,
        addRandomSuffix: false,
        token: this.configs.token,
      });

      return {
        success: true,
        location: result.url,
        key: key,
        filename: key.split('/').pop(),
        url: result.url,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  /**
   * Get public URL for Vercel Blob object
   * Vercel Blob URLs are public and permanent (no presigning needed)
   * This method is provided for compatibility with R2Provider interface
   * @param key Storage key
   * @param expiresIn Expiration time in seconds (ignored for Vercel Blob)
   * @returns Public URL
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 86400
  ): Promise<string> {
    try {
      if (!this.configs.token) {
        throw new Error('BLOB_READ_WRITE_TOKEN is required');
      }

      // For Vercel Blob, we need to check if the blob exists and get its URL
      // Since we store the full URL in the database, we can return it directly
      // If we only have the key, we need to construct the URL or use head() to get it
      
      // Try to get blob info using head() to verify it exists
      // Note: head() requires the full URL, not just the key
      // So we'll construct a URL pattern based on Vercel Blob's URL structure
      
      // Vercel Blob URLs follow pattern: https://{hash}.public.blob.vercel-storage.com/{key}
      // Since we don't have the hash, we'll need to store the full URL when uploading
      // For now, we'll throw an error if only key is provided
      throw new Error(
        'Vercel Blob requires full URL. Use the URL returned from upload instead of key.'
      );
    } catch (error) {
      throw new Error(
        `Failed to get URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get public URL from blob URL (helper method)
   * If you have the full blob URL, use this to get it directly
   * @param blobUrl Full Vercel Blob URL
   * @returns Public URL (same as input)
   */
  getPublicUrl(blobUrl: string): string {
    return blobUrl;
  }

  /**
   * Delete file from Vercel Blob
   * @param url Full Vercel Blob URL
   */
  async deleteFile(url: string): Promise<void> {
    if (!this.configs.token) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required');
    }

    await del(url, { token: this.configs.token });
  }
}

/**
 * Create Vercel Blob provider with configs
 */
export function createVercelBlobProvider(
  configs: VercelBlobConfigs = {}
): VercelBlobProvider {
  return new VercelBlobProvider(configs);
}

