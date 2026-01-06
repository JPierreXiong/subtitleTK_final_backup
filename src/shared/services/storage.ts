import {
  R2Provider,
  S3Provider,
  VercelBlobProvider,
  StorageManager,
} from '@/extensions/storage';
import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * get storage service with configs
 */
export function getStorageServiceWithConfigs(configs: Configs) {
  const storageManager = new StorageManager();

  // Determine default provider from config or environment variable
  const storageProvider =
    configs.storage_provider ||
    process.env.STORAGE_PROVIDER ||
    null; // No default, will be determined by priority

  // Add Vercel Blob provider if configured (priority: highest)
  const blobToken =
    configs.blob_read_write_token || process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    const vercelBlobProvider = new VercelBlobProvider({
      token: blobToken,
    });
    // Set as default if explicitly configured OR if no provider is specified
    const isDefault =
      storageProvider === 'vercel-blob' || storageProvider === null;
    storageManager.addProvider(vercelBlobProvider, isDefault);
  }

  // Add R2 provider if configured
  if (
    configs.r2_access_key &&
    configs.r2_secret_key &&
    configs.r2_bucket_name
  ) {
    // r2_region in settings stores the Cloudflare Account ID
    // For R2, region is typically "auto" but can be customized
    const accountId = configs.r2_account_id || '';

    storageManager.addProvider(
      new R2Provider({
        accountId: accountId,
        accessKeyId: configs.r2_access_key,
        secretAccessKey: configs.r2_secret_key,
        bucket: configs.r2_bucket_name,
        region: 'auto', // R2 uses "auto" as region
        endpoint: configs.r2_endpoint, // Optional custom endpoint
        publicDomain: configs.r2_domain,
      }),
      storageProvider === 'r2' // Set as default if configured
    );
  }

  // Add S3 provider if configured (future support)
  if (configs.s3_access_key && configs.s3_secret_key && configs.s3_bucket) {
    storageManager.addProvider(
      new S3Provider({
        endpoint: configs.s3_endpoint,
        region: configs.s3_region,
        accessKeyId: configs.s3_access_key,
        secretAccessKey: configs.s3_secret_key,
        bucket: configs.s3_bucket,
        publicDomain: configs.s3_domain,
      }),
      storageProvider === 's3' // Set as default if configured
    );
  }

  return storageManager;
}

/**
 * global storage service
 */
let storageService: StorageManager | null = null;

/**
 * get storage service instance
 */
export async function getStorageService(): Promise<StorageManager> {
  if (true) {
    const configs = await getAllConfigs();
    storageService = getStorageServiceWithConfigs(configs);
  }
  return storageService;
}
