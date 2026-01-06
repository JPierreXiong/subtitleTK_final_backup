import type {
  StorageConfigs,
  StorageDownloadUploadOptions,
  StorageProvider,
  StorageUploadOptions,
  StorageUploadResult,
} from '.';

/**
 * R2 storage provider configs
 * @docs https://developers.cloudflare.com/r2/
 */
export interface R2Configs extends StorageConfigs {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  endpoint?: string;
  publicDomain?: string;
}

/**
 * R2 storage provider implementation
 * @website https://www.cloudflare.com/products/r2/
 */
export class R2Provider implements StorageProvider {
  readonly name = 'r2';
  configs: R2Configs;

  constructor(configs: R2Configs) {
    this.configs = configs;
  }

  async uploadFile(
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    try {
      const uploadBucket = options.bucket || this.configs.bucket;
      if (!uploadBucket) {
        return {
          success: false,
          error: 'Bucket is required',
          provider: this.name,
        };
      }

      const bodyArray =
        options.body instanceof Buffer
          ? new Uint8Array(options.body)
          : options.body;

      // R2 endpoint format: https://<accountId>.r2.cloudflarestorage.com
      // Use custom endpoint if provided, otherwise use default
      const endpoint =
        this.configs.endpoint ||
        `https://${this.configs.accountId}.r2.cloudflarestorage.com`;
      const url = `${endpoint}/${uploadBucket}/${options.key}`;

      const { AwsClient } = await import('aws4fetch');

      // R2 uses "auto" as region for S3 API compatibility
      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
      });

      const headers: Record<string, string> = {
        'Content-Type': options.contentType || 'application/octet-stream',
        'Content-Disposition': options.disposition || 'inline',
        'Content-Length': bodyArray.length.toString(),
      };

      const request = new Request(url, {
        method: 'PUT',
        headers,
        body: bodyArray as any,
      });

      const response = await client.fetch(request);

      if (!response.ok) {
        return {
          success: false,
          error: `Upload failed: ${response.statusText}`,
          provider: this.name,
        };
      }

      const publicUrl = this.configs.publicDomain
        ? `${this.configs.publicDomain}/${options.key}`
        : url;

      return {
        success: true,
        location: url,
        bucket: uploadBucket,
        key: options.key,
        filename: options.key.split('/').pop(),
        url: publicUrl,
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

  async downloadAndUpload(
    options: StorageDownloadUploadOptions
  ): Promise<StorageUploadResult> {
    try {
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

      const arrayBuffer = await response.arrayBuffer();
      const body = new Uint8Array(arrayBuffer);

      return this.uploadFile({
        body,
        key: options.key,
        bucket: options.bucket,
        contentType: options.contentType,
        disposition: options.disposition,
      });
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
   * Downloads video stream and uploads to R2 without loading entire file into memory
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
      const uploadBucket = this.configs.bucket;
      if (!uploadBucket) {
        return {
          success: false,
          error: 'Bucket is required',
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

      // Stream upload to R2
      const endpoint =
        this.configs.endpoint ||
        `https://${this.configs.accountId}.r2.cloudflarestorage.com`;
      const url = `${endpoint}/${uploadBucket}/${key}`;

      const { AwsClient } = await import('aws4fetch');

      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
      });

      // Create a new request with the stream body
      const request = new Request(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
        },
        body: response.body as any,
        // @ts-ignore - duplex is required for streaming requests in some environments
        duplex: 'half',
      } as any);

      const uploadResponse = await client.fetch(request);

      if (!uploadResponse.ok) {
        return {
          success: false,
          error: `Upload failed: ${uploadResponse.statusText}`,
          provider: this.name,
        };
      }

      const publicUrl = this.configs.publicDomain
        ? `${this.configs.publicDomain}/${key}`
        : url;

      return {
        success: true,
        location: url,
        bucket: uploadBucket,
        key: key,
        filename: key.split('/').pop(),
        url: publicUrl,
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
   * Generate presigned URL for private R2 object
   * @param key Storage key
   * @param expiresIn Expiration time in seconds (default: 86400 = 24 hours)
   * @returns Presigned URL
   */
  async getPresignedUrl(
    key: string,
    expiresIn: number = 86400
  ): Promise<string> {
    try {
      const uploadBucket = this.configs.bucket;
      if (!uploadBucket) {
        throw new Error('Bucket is required');
      }

      const endpoint =
        this.configs.endpoint ||
        `https://${this.configs.accountId}.r2.cloudflarestorage.com`;
      const url = `${endpoint}/${uploadBucket}/${key}`;

      const { AwsClient } = await import('aws4fetch');

      const client = new AwsClient({
        accessKeyId: this.configs.accessKeyId,
        secretAccessKey: this.configs.secretAccessKey,
        region: this.configs.region || 'auto',
      });

      // Create a GET request
      const request = new Request(url, {
        method: 'GET',
      });

      // Sign the request with expiration
      const signedRequest = await client.sign(request, {
        signQuery: true as any,
        expiresIn: expiresIn,
      } as any);

      return signedRequest.url;
    } catch (error) {
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Create R2 provider with configs
 */
export function createR2Provider(configs: R2Configs): R2Provider {
  return new R2Provider(configs);
}
