/**
 * Media Data Sanitizer
 * 清理和验证媒体数据，确保数据库更新不会失败
 * 
 * 主要问题：
 * 1. duration 可能是字符串格式 "00:28"，需要转换为秒数
 * 2. URL 可能过长，需要截断
 * 3. 空字符串需要转换为 null
 * 4. progress 需要限制在 0-100 范围内
 */

/**
 * Parse duration from various formats to seconds
 * Supports:
 * - "00:28" (mm:ss)
 * - "01:23:45" (hh:mm:ss)
 * - 28 (number, already in seconds)
 * - "28" (string number)
 */
export function parseDurationToSeconds(duration: any): number | null {
  if (duration === null || duration === undefined) {
    return null;
  }

  // If already a number, return it (assuming it's in seconds)
  if (typeof duration === 'number') {
    return Math.floor(duration); // Ensure integer
  }

  // If string, try to parse
  if (typeof duration === 'string') {
    // Remove whitespace
    const trimmed = duration.trim();
    
    // If empty string, return null
    if (trimmed === '') {
      return null;
    }

    // Try to parse as number first (e.g., "28")
    const asNumber = Number(trimmed);
    if (!isNaN(asNumber) && isFinite(asNumber)) {
      return Math.floor(asNumber);
    }

    // Try to parse as time format (e.g., "00:28" or "01:23:45")
    const timeParts = trimmed.split(':');
    if (timeParts.length === 2) {
      // mm:ss format
      const minutes = parseInt(timeParts[0], 10);
      const seconds = parseInt(timeParts[1], 10);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return minutes * 60 + seconds;
      }
    } else if (timeParts.length === 3) {
      // hh:mm:ss format
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = parseInt(timeParts[2], 10);
      if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        return hours * 3600 + minutes * 60 + seconds;
      }
    }
  }

  // If we can't parse it, return null (don't fail the update)
  console.warn(`[MediaDataSanitizer] Unable to parse duration: ${duration}`);
  return null;
}

/**
 * Sanitize URL: truncate if too long, ensure it's a valid string
 * Max length: 2000 characters (PostgreSQL TEXT can handle more, but we limit for safety)
 */
export function sanitizeUrl(url: string | null | undefined, maxLength: number = 2000): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }

  // Truncate if too long
  if (trimmed.length > maxLength) {
    console.warn(`[MediaDataSanitizer] URL truncated from ${trimmed.length} to ${maxLength} characters`);
    return trimmed.substring(0, maxLength);
  }

  return trimmed;
}

/**
 * Sanitize text field: convert empty string to null
 */
export function sanitizeText(text: string | null | undefined): string | null {
  if (text === null || text === undefined) {
    return null;
  }

  if (typeof text === 'string') {
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  }

  return null;
}

/**
 * Sanitize integer: ensure it's a valid integer or null
 */
export function sanitizeInteger(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Math.floor(value); // Ensure integer
  }

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Sanitize progress: ensure it's between 0 and 100
 */
export function sanitizeProgress(progress: any): number {
  const num = sanitizeInteger(progress);
  if (num === null) {
    return 0;
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, num));
}

/**
 * Sanitize media task update data
 * This is the main function to use before calling updateMediaTaskById
 */
export function sanitizeMediaTaskUpdate(data: {
  duration?: any;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  author?: string | null;
  title?: string | null;
  progress?: any;
  likes?: any;
  views?: any;
  shares?: any;
  [key: string]: any;
}): {
  duration?: number | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  author?: string | null;
  title?: string | null;
  progress?: number;
  likes?: number | null;
  views?: number | null;
  shares?: number | null;
  [key: string]: any;
} {
  const sanitized: any = { ...data };

  // Sanitize duration (convert "00:28" to 28)
  if ('duration' in sanitized) {
    sanitized.duration = parseDurationToSeconds(sanitized.duration);
  }

  // Sanitize URLs
  if ('thumbnailUrl' in sanitized) {
    sanitized.thumbnailUrl = sanitizeUrl(sanitized.thumbnailUrl);
  }

  if ('videoUrl' in sanitized) {
    sanitized.videoUrl = sanitizeUrl(sanitized.videoUrl);
  }

  // Sanitize text fields (convert empty string to null)
  if ('author' in sanitized) {
    sanitized.author = sanitizeText(sanitized.author);
  }

  if ('title' in sanitized) {
    sanitized.title = sanitizeText(sanitized.title);
  }

  // Sanitize progress (ensure 0-100)
  if ('progress' in sanitized) {
    sanitized.progress = sanitizeProgress(sanitized.progress);
  }

  // Sanitize integer fields
  if ('likes' in sanitized) {
    sanitized.likes = sanitizeInteger(sanitized.likes);
  }

  if ('views' in sanitized) {
    sanitized.views = sanitizeInteger(sanitized.views);
  }

  if ('shares' in sanitized) {
    sanitized.shares = sanitizeInteger(sanitized.shares);
  }

  return sanitized;
}

