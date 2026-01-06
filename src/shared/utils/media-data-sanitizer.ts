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
 * 
 * Note: Returns undefined for null values to match TypeScript types
 * (Drizzle expects undefined for optional fields, not null)
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
  thumbnailUrl?: string | undefined;
  videoUrl?: string | undefined;
  author?: string | undefined;
  title?: string | undefined;
  progress?: number;
  likes?: number | undefined;
  views?: number | undefined;
  shares?: number | undefined;
  [key: string]: any;
} {
  const sanitized: any = { ...data };

  // Sanitize duration (convert "00:28" to 28)
  if ('duration' in sanitized) {
    const durationValue = parseDurationToSeconds(sanitized.duration);
    if (durationValue === null) {
      delete sanitized.duration; // Remove null values
    } else {
      sanitized.duration = durationValue;
    }
  }

  // Sanitize URLs (convert null to undefined for TypeScript compatibility)
  if ('thumbnailUrl' in sanitized) {
    const urlValue = sanitizeUrl(sanitized.thumbnailUrl);
    if (urlValue === null) {
      delete sanitized.thumbnailUrl; // Remove null values
    } else {
      sanitized.thumbnailUrl = urlValue;
    }
  }

  if ('videoUrl' in sanitized) {
    const urlValue = sanitizeUrl(sanitized.videoUrl);
    if (urlValue === null) {
      delete sanitized.videoUrl; // Remove null values (videoUrl is notNull in schema)
    } else {
      sanitized.videoUrl = urlValue;
    }
  }

  // Sanitize text fields (convert null to undefined)
  if ('author' in sanitized) {
    const textValue = sanitizeText(sanitized.author);
    if (textValue === null) {
      delete sanitized.author; // Remove null values
    } else {
      sanitized.author = textValue;
    }
  }

  if ('title' in sanitized) {
    const textValue = sanitizeText(sanitized.title);
    if (textValue === null) {
      delete sanitized.title; // Remove null values
    } else {
      sanitized.title = textValue;
    }
  }

  // Sanitize progress (ensure 0-100)
  if ('progress' in sanitized) {
    sanitized.progress = sanitizeProgress(sanitized.progress);
  }

  // Sanitize integer fields (convert null to undefined)
  if ('likes' in sanitized) {
    const intValue = sanitizeInteger(sanitized.likes);
    if (intValue === null) {
      delete sanitized.likes; // Remove null values
    } else {
      sanitized.likes = intValue;
    }
  }

  if ('views' in sanitized) {
    const intValue = sanitizeInteger(sanitized.views);
    if (intValue === null) {
      delete sanitized.views; // Remove null values
    } else {
      sanitized.views = intValue;
    }
  }

  if ('shares' in sanitized) {
    const intValue = sanitizeInteger(sanitized.shares);
    if (intValue === null) {
      delete sanitized.shares; // Remove null values
    } else {
      sanitized.shares = intValue;
    }
  }

  return sanitized;
}

