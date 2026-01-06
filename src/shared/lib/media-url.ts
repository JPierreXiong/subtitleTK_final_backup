/**
 * Media URL normalization and fingerprinting utilities
 * Used for video cache lookup and deduplication
 */

import { createHash } from 'crypto';

/**
 * Normalize YouTube URL to standard format
 * Converts various formats (youtu.be, shorts, etc.) to watch?v= format
 */
export function normalizeYouTubeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Handle youtu.be short links
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1); // Remove leading /
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // Handle YouTube Shorts
    if (urlObj.pathname.includes('/shorts/')) {
      const match = urlObj.pathname.match(/\/shorts\/([^/?]+)/);
      if (match && match[1]) {
        return `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }
    
    // Handle standard watch?v= format - extract video ID and reconstruct
    if (urlObj.pathname === '/watch' && urlObj.searchParams.has('v')) {
      const videoId = urlObj.searchParams.get('v');
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // If URL is already in standard format or can't be normalized, return as-is
    return url;
  } catch (e) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Normalize TikTok URL by removing tracking parameters
 * Keeps only the core path (hostname + pathname)
 */
export function normalizeTikTokUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove query parameters and hash, keep only protocol, hostname, and pathname
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch (e) {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Normalize video URL based on platform
 * Automatically detects platform and applies appropriate normalization
 */
export function normalizeVideoUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return normalizeYouTubeUrl(url);
  }
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    return normalizeTikTokUrl(url);
  }
  return url;
}

/**
 * Generate video fingerprint (SHA-256 hash) from normalized URL
 * Used as cache key to identify identical videos across different user inputs
 */
export function generateVideoFingerprint(url: string): string {
  const normalizedUrl = normalizeVideoUrl(url);
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

