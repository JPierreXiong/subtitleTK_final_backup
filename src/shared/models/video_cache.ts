/**
 * Video Cache Model
 * Handles caching of video download URLs to reduce RapidAPI calls
 */

import { db } from '@/core/db';
import { videoCache } from '@/config/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

export interface NewVideoCache {
  originalUrl: string;
  downloadUrl: string;
  platform: 'youtube' | 'tiktok';
  expiresInHours?: number;
}

export type VideoCache = typeof videoCache.$inferSelect;

/**
 * Find valid video cache entry
 * Returns cache entry only if it exists and hasn't expired
 */
export async function findValidVideoCache(
  fingerprint: string
): Promise<VideoCache | null> {
  const now = new Date();

  const results = await db()
    .select()
    .from(videoCache)
    .where(
      and(
        eq(videoCache.id, fingerprint),
        gt(videoCache.expiresAt, now) // Only return if not expired
      )
    )
    .limit(1);

  return results[0] || null;
}

/**
 * Set or update video cache entry
 * Uses upsert pattern: insert if not exists, update if exists
 */
export async function setVideoCache(
  fingerprint: string,
  data: NewVideoCache
): Promise<VideoCache> {
  const { originalUrl, downloadUrl, platform, expiresInHours = 12 } = data;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  // Use PostgreSQL's ON CONFLICT DO UPDATE for upsert
  const [result] = await db()
    .insert(videoCache)
    .values({
      id: fingerprint,
      originalUrl,
      downloadUrl,
      platform,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: videoCache.id,
      set: {
        downloadUrl,
        expiresAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

/**
 * Delete expired cache entries (maintenance function)
 * Can be called periodically to clean up old cache entries
 */
export async function deleteExpiredCacheEntries(): Promise<number> {
  const now = new Date();

  // Delete entries where expiresAt is less than current time
  const deletedResult = await db()
    .delete(videoCache)
    .where(lt(videoCache.expiresAt, now))
    .returning();

  return deletedResult.length;
}

