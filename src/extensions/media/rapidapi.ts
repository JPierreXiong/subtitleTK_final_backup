/**
 * RapidAPI Provider for YouTube and TikTok media extraction
 * Handles video metadata and subtitle extraction from RapidAPI services
 */

import { SubtitleFormatter } from './subtitle-formatter';

/**
 * RapidAPI configuration interface
 */
export interface RapidAPIConfigs {
  apiKey: string;
  // 主备配置（从环境变量读取）
  tiktokTranscript?: {
    primaryHost: string;
    backupHost: string;
  };
  tiktokVideo?: {
    primaryHost: string;
    backupHost: string;
  };
  youtubeTranscript?: {
    primaryHost: string;
    backupHost: string;
  };
  youtubeVideo?: {
    primaryHost: string;
    backupHost: string;
  };
  // 向后兼容的旧配置（如果新配置不存在，使用这些）
  hostTikTokDownload?: string;
  hostTikTokTranscript?: string;
  hostYouTubeTranscript?: string;
  hostYouTubeDownload?: string;
}

/**
 * Normalized media data output interface
 * Standardized format for database storage
 */
export interface NormalizedMediaData {
  platform: 'youtube' | 'tiktok';
  title: string;
  author?: string;
  likes: number;
  views: number;
  shares: number;
  duration?: number;
  publishedAt?: Date;
  thumbnailUrl?: string;
  videoUrl?: string; // Original video download URL (for R2 upload)
  subtitleRaw?: string; // Formatted SRT string
  sourceLang?: string; // Detected source language
  // Additional metadata
  subtitleCharCount?: number; // Character count of subtitle (for translation estimation)
  subtitleLineCount?: number; // Line count of subtitle (for translation estimation)
  isTikTokVideo?: boolean; // Flag to indicate if this is a TikTok video with downloadable URL
}

/**
 * RapidAPI Provider class
 * Handles media extraction from YouTube and TikTok via RapidAPI
 */
export class RapidAPIProvider {
  private configs: RapidAPIConfigs;
  private readonly DEFAULT_TIMEOUT = 180000; // 3 minutes

  constructor(configs: RapidAPIConfigs) {
    this.configs = configs;
  }

  /**
   * Main entry point: Automatically identify platform and extract media data
   * @param url Video URL (YouTube or TikTok)
   * @param outputType Output type: 'subtitle' for subtitle extraction, 'video' for video download
   * @returns Normalized media data
   */
  async fetchMedia(url: string, outputType: 'subtitle' | 'video' = 'subtitle'): Promise<NormalizedMediaData> {
    const platform = this.identifyPlatform(url);

    if (platform === 'tiktok') {
      // For TikTok, use different APIs based on outputType
      if (outputType === 'video') {
        return await this.fetchTikTokVideo(url);
      } else {
        return await this.fetchTikTokMedia(url);
      }
    } else if (platform === 'youtube') {
      // For YouTube, use different APIs based on outputType
      if (outputType === 'video') {
        return await this.fetchYouTubeVideo(url);
      } else {
        return await this.fetchYouTubeMedia(url);
      }
    } else {
      throw new Error(`Unsupported platform for URL: ${url}`);
    }
  }

  /**
   * Identify platform from URL
   * @param url Video URL
   * @returns Platform type
   */
  private identifyPlatform(url: string): 'youtube' | 'tiktok' {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    throw new Error(`Cannot identify platform from URL: ${url}`);
  }

  /**
   * Extract YouTube video metadata and subtitles
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url YouTube video URL
   * @returns Normalized media data
   */
  private async fetchYouTubeMedia(url: string): Promise<NormalizedMediaData> {
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    // Extract video ID for free API
    const videoId = this.extractYouTubeVideoId(formattedUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // Step 1: Try Free API first (only call once)
    let transcriptData: any = null;
    let metadata: any = {};
    
    try {
      console.log('[YouTube Transcript] Attempting Free API...');
      const freeApiResult = await this.fetchYouTubeTranscriptFreeAPI(videoId);
      
      if (freeApiResult.success && freeApiResult.transcriptData) {
        console.log('[YouTube Transcript] Free API succeeded!');
        transcriptData = freeApiResult.transcriptData;
        metadata = freeApiResult.metadata || {};
      } else {
        // Free API failed, log reason and switch to Paid API
        console.warn(`[YouTube Transcript] Free API failed: ${freeApiResult.reason} - ${freeApiResult.message}`);
        throw new Error(`Free API failed: ${freeApiResult.reason}`);
      }
    } catch (error: any) {
      // Free API failed, try Paid API (only call once)
      console.log('[YouTube Transcript] Switching to Paid API as fallback...');
      
      try {
        const paidApiResult = await this.fetchYouTubeTranscriptPaidAPI(formattedUrl);
        
        if (paidApiResult.success && paidApiResult.transcriptData) {
          console.log('[YouTube Transcript] Paid API succeeded!');
          transcriptData = paidApiResult.transcriptData;
          metadata = paidApiResult.metadata || {};
        } else {
          // Both APIs failed
          console.error(`[YouTube Transcript] Paid API also failed: ${paidApiResult.reason} - ${paidApiResult.message}`);
          throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
        }
      } catch (paidError: any) {
        // Both APIs failed, throw error
        console.error('[YouTube Transcript] All APIs failed');
        throw new Error(`Failed to fetch YouTube transcript: ${paidError.message}`);
      }
    }

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'youtube')
      : null;

    // Extract metadata from transcript response if available
    const normalizedMetadata = this.normalizeMetadata(transcriptData || metadata || {}, 'youtube');

    // Calculate subtitle statistics
    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'youtube',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: false,
    };
  }

  /**
   * Fetch YouTube video download via RapidAPI (for video download only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * 确保每个API只调用1次，不重复调用
   * @param url YouTube video URL
   * @returns Normalized media data with video URL
   */
  private async fetchYouTubeVideo(url: string): Promise<NormalizedMediaData> {
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    // Extract video ID from URL
    const videoId = this.extractYouTubeVideoId(formattedUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // Step 1: Try Free API first (只调用1次)
    // 免费API：snap-video3.p.rapidapi.com（免费配额多）
    let videoData: any = null;
    let metadata: any = {};
    
    try {
      console.log('[YouTube Video Download] Attempting Free API (snap-video3)...');
      const freeApiResult = await this.fetchYouTubeVideoDownloadFreeAPI(formattedUrl);
      
      if (freeApiResult.success && freeApiResult.videoData) {
        // ✅ 免费API成功，立即返回，不再调用付费API
        console.log('[YouTube Video Download] Free API succeeded!');
        videoData = freeApiResult.videoData;
        metadata = freeApiResult.metadata || {};
      } else {
        // Free API failed, log reason and switch to Paid API
        console.warn(`[YouTube Video Download] Free API failed: ${freeApiResult.reason} - ${freeApiResult.message}`);
        throw new Error(`Free API failed: ${freeApiResult.reason}`);
      }
    } catch (error: any) {
      // Free API failed, try Paid API (只调用1次)
      // 付费API：cloud-api-hub-youtube-downloader.p.rapidapi.com（收费便宜）
      console.log('[YouTube Video Download] Switching to Paid API (cloud-api-hub-youtube-downloader) as fallback...');
      
      try {
        const paidApiResult = await this.fetchYouTubeVideoDownloadPaidAPI(videoId);
        
        if (paidApiResult.success && paidApiResult.videoData) {
          console.log('[YouTube Video Download] Paid API succeeded!');
          videoData = paidApiResult.videoData;
          metadata = paidApiResult.metadata || {};
        } else {
          // Both APIs failed
          console.error(`[YouTube Video Download] Paid API also failed: ${paidApiResult.reason} - ${paidApiResult.message}`);
          throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
        }
      } catch (paidError: any) {
        // Both APIs failed, throw error
        console.error('[YouTube Video Download] All APIs failed');
        throw new Error(`Failed to fetch YouTube video: ${paidError.message}`);
      }
    }

    // Normalize metadata
    const metadata = this.normalizeMetadata(videoData, 'youtube');

    // Extract video URL from API response
    // Common response formats:
    // - { data: { video_url: "...", download_url: "...", url: "..." } }
    // - { video: { url: "...", download: "..." } }
    // - { url: "...", download_url: "..." }
    // - { formats: [{ url: "..." }] }
    const videoUrl =
      videoData.data?.video_url ||
      videoData.data?.download_url ||
      videoData.data?.url ||
      videoData.video?.url ||
      videoData.video?.download_url ||
      videoData.url ||
      videoData.download_url ||
      videoData.download ||
      (videoData.formats && Array.isArray(videoData.formats) && videoData.formats.length > 0
        ? videoData.formats[0].url || videoData.formats[0].video_url
        : null);

    // Try to get subtitle if available (optional for video download)
    let subtitleRaw: string | null = null;
    if (videoData.subtitles || videoData.transcript) {
      subtitleRaw = this.normalizeSubtitles(videoData, 'youtube');
    }

    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'youtube',
      title: metadata.title || '',
      author: metadata.author,
      likes: metadata.likes || 0,
      views: metadata.views || 0,
      shares: metadata.shares || 0,
      duration: metadata.duration,
      publishedAt: metadata.publishedAt,
      thumbnailUrl: metadata.thumbnailUrl,
      videoUrl: videoUrl,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: metadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: false, // YouTube video flag
    };
  }

  /**
   * Fetch YouTube video download via RapidAPI
   * Uses the video download API endpoint
   * API: https://youtube-video-and-shorts-downloader1.p.rapidapi.com/
   * Tries multiple possible endpoints
   * @param url YouTube video URL
   * @param videoId YouTube video ID
   * @param host RapidAPI host
   * @returns Video download data
   */
  private async fetchYouTubeVideoDownload(url: string, videoId: string, host: string): Promise<any> {
    // Try multiple possible endpoints
    // Endpoint 1: Direct video download endpoint with videoId
    let apiUrl = `https://${host}/youtube/video/download?videoId=${videoId}`;
    
    let response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    // If first endpoint fails, try alternative endpoint with URL
    if (!response.ok) {
      apiUrl = `https://${host}/youtube/video/download`;
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': this.configs.apiKey,
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });
    }

    // If still fails, try with videoId in POST body
    if (!response.ok) {
      apiUrl = `https://${host}/youtube/video/download`;
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': this.configs.apiKey,
        },
        body: JSON.stringify({ videoId }),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `YouTube video download API failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    
    // Log response for debugging (can be removed in production)
    console.log('YouTube video download API response:', JSON.stringify(data, null, 2));
    
    return data;
  }

  /**
   * Fetch YouTube video download via Free API (Snap Video3)
   * 免费API：snap-video3.p.rapidapi.com（免费配额多）
   * 只调用1次，如果失败则切换到付费API
   * @param url YouTube video URL
   * @returns Result with video data or failure reason
   */
  private async fetchYouTubeVideoDownloadFreeAPI(
    url: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 15000; // 15 seconds timeout
    
    // 使用配置中的主 API Host（从环境变量读取）
    // 免费API：snap-video3.p.rapidapi.com（免费配额多）
    const host = this.configs.youtubeVideo?.primaryHost || 
                 this.configs.hostYouTubeDownload || 
                 'snap-video3.p.rapidapi.com';
    const apiUrl = `https://${host}/download`;

    try {
      // Create form data with URL parameter
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      // 尝试提取视频URL（可能在不同字段中）
      const videoUrl =
        data.data?.video_url ||
        data.data?.download_url ||
        data.data?.url ||
        data.data?.video?.url ||
        data.data?.video?.download_url ||
        data.data?.nwm_video_url ||
        data.data?.no_watermark ||
        data.video_url ||
        data.download_url ||
        data.url ||
        data.download ||
        (data.formats && Array.isArray(data.formats) && data.formats.length > 0
          ? data.formats[0].url || data.formats[0].video_url
          : null);

      // 检查是否有视频URL
      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: 'No video URL available in response',
        };
      }

      // 检查视频URL是否有效（应该是http/https链接）
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube video download via Paid API (Cloud API Hub YouTube Downloader)
   * 付费API：cloud-api-hub-youtube-downloader.p.rapidapi.com（收费便宜）
   * 只调用1次，作为免费API失败后的降级方案
   * @param videoId YouTube video ID
   * @returns Result with video data or failure reason
   */
  private async fetchYouTubeVideoDownloadPaidAPI(
    videoId: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    // 付费API：cloud-api-hub-youtube-downloader.p.rapidapi.com（收费便宜）
    const host = this.configs.youtubeVideo?.backupHost || 
                 this.configs.hostYouTubeDownload || 
                 'cloud-api-hub-youtube-downloader.p.rapidapi.com';
    const apiUrl = `https://${host}/download?id=${videoId}&filter=audioandvideo&quality=lowest`;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        // 明确识别403为配额限制或权限问题
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: `HTTP 403: Forbidden - Paid API quota exceeded or access denied`,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: `HTTP 429: Rate limit exceeded`,
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMsg = data.error || data.message || '';
      const errorMessage = errorMsg.toLowerCase();
      
      // 检查配额/限额相关错误（优先检查）
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('exceeded') ||
        errorMessage.includes('disabled') ||
        errorMessage.includes('forbidden')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: errorMsg || 'Paid API quota exceeded or disabled',
        };
      }

      // 尝试提取视频URL（可能在不同字段中）
      const videoUrl =
        data.data?.video_url ||
        data.data?.download_url ||
        data.data?.url ||
        data.data?.video?.url ||
        data.data?.video?.download_url ||
        data.video_url ||
        data.download_url ||
        data.url ||
        data.download ||
        (data.formats && Array.isArray(data.formats) && data.formats.length > 0
          ? data.formats[0].url || data.formats[0].video_url
          : null);

      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: errorMsg || 'No video URL available',
        };
      }

      // 检查视频URL是否有效
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // 检查特定错误信息
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url') ||
        errorMessage.includes('invalid id')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok video download via RapidAPI (for video download only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url TikTok video URL
   * @returns Normalized media data with video URL
   */
  private async fetchTikTokVideo(url: string): Promise<NormalizedMediaData> {
    // Extract video ID from URL (for validation)
    const videoId = this.extractTikTokVideoId(url);
    if (!videoId) {
      throw new Error(`Invalid TikTok URL: ${url}`);
    }

    // Step 1: Try Free API first (only call once)
    let videoData: any = null;
    let metadata: any = {};
    
    try {
      console.log('[TikTok Video Download] Attempting Free API...');
      const freeApiResult = await this.fetchTikTokVideoDownloadFreeAPI(url);
      
      if (freeApiResult.success && freeApiResult.videoData) {
        console.log('[TikTok Video Download] Free API succeeded!');
        videoData = freeApiResult.videoData;
        metadata = freeApiResult.metadata || {};
      } else {
        // Free API failed, log reason and switch to Paid API
        console.warn(`[TikTok Video Download] Free API failed: ${freeApiResult.reason} - ${freeApiResult.message}`);
        throw new Error(`Free API failed: ${freeApiResult.reason}`);
      }
    } catch (error: any) {
      // Free API failed, try Paid API (only call once)
      console.log('[TikTok Video Download] Switching to Paid API as fallback...');
      
      try {
        const paidApiResult = await this.fetchTikTokVideoDownloadPaidAPI(url);
        
        if (paidApiResult.success && paidApiResult.videoData) {
          console.log('[TikTok Video Download] Paid API succeeded!');
          videoData = paidApiResult.videoData;
          metadata = paidApiResult.metadata || {};
        } else {
          // Both APIs failed
          console.error(`[TikTok Video Download] Paid API also failed: ${paidApiResult.reason} - ${paidApiResult.message}`);
          throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
        }
      } catch (paidError: any) {
        // Both APIs failed, throw error
        console.error('[TikTok Video Download] All APIs failed');
        throw new Error(`Failed to fetch TikTok video: ${paidError.message}`);
      }
    }

    // Normalize metadata
    const normalizedMetadata = this.normalizeMetadata(videoData || metadata || {}, 'tiktok');

    // Extract video URL (no-watermark preferred)
    // Try multiple possible field names from API response
    // Common response formats:
    // - { data: { play: "...", download_addr: "..." } }
    // - { play: "...", download_addr: "..." }
    // - { video: { play: "...", download_addr: "..." } }
    // - { nwm_video_url: "...", no_watermark: "..." }
    const videoUrl =
      videoData.data?.play ||
      videoData.data?.download_addr ||
      videoData.data?.video_url ||
      videoData.data?.video?.play ||
      videoData.data?.video?.download_addr ||
      videoData.data?.nwm_video_url ||
      videoData.data?.no_watermark ||
      videoData.play ||
      videoData.download_addr ||
      videoData.video_url ||
      videoData.video?.play ||
      videoData.video?.download_addr ||
      videoData.nwm_video_url ||
      videoData.no_watermark ||
      videoData.download ||
      videoData.url; // Some APIs return direct URL

    // Try to get subtitle if available (optional for video download)
    let subtitleRaw: string | null = null;
    if (videoData.subtitles || videoData.transcript) {
      subtitleRaw = this.normalizeSubtitles(videoData, 'tiktok');
    }

    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'tiktok',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      videoUrl: videoUrl,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: !!videoUrl,
    };
  }

  /**
   * Extract TikTok video metadata and subtitles (for subtitle extraction only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url TikTok video URL
   * @returns Normalized media data
   */
  /**
   * Extract TikTok video metadata and subtitles (for subtitle extraction only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * 确保每个API只调用1次，不重复调用
   * @param url TikTok video URL
   * @returns Normalized media data
   */
  private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData> {
    // Step 1: Try Free API first (只调用1次)
    // 免费API：tiktok-transcriptor-api3.p.rapidapi.com（免费配额多）
    let transcriptData: any = null;
    let metadata: any = {};
    
    try {
      console.log('[TikTok Transcript] Attempting Free API (tiktok-transcriptor-api3)...');
      const freeApiResult = await this.fetchTikTokTranscriptFreeAPI(url);
      
      if (freeApiResult.success && freeApiResult.transcriptData) {
        // ✅ 免费API成功，立即返回，不再调用付费API
        console.log('[TikTok Transcript] Free API succeeded!');
        transcriptData = freeApiResult.transcriptData;
        metadata = freeApiResult.metadata || {};
      } else {
        // Free API failed, log reason and switch to Paid API
        console.warn(`[TikTok Transcript] Free API failed: ${freeApiResult.reason} - ${freeApiResult.message}`);
        throw new Error(`Free API failed: ${freeApiResult.reason}`);
      }
    } catch (error: any) {
      // Free API failed, try Paid API (只调用1次)
      // 付费API：tiktok-transcript.p.rapidapi.com（收费便宜）
      console.log('[TikTok Transcript] Switching to Paid API (tiktok-transcript) as fallback...');
      
      try {
        const paidApiResult = await this.fetchTikTokTranscriptPaidAPI(url);
        
        if (paidApiResult.success && paidApiResult.transcriptData) {
          console.log('[TikTok Transcript] Paid API succeeded!');
          transcriptData = paidApiResult.transcriptData;
          metadata = paidApiResult.metadata || {};
        } else {
          // Both APIs failed
          console.error(`[TikTok Transcript] Paid API also failed: ${paidApiResult.reason} - ${paidApiResult.message}`);
          throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
        }
      } catch (paidError: any) {
        // Both APIs failed, throw error
        console.error('[TikTok Transcript] All APIs failed');
        throw new Error(`Failed to fetch TikTok transcript: ${paidError.message}`);
      }
    }

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'tiktok')
      : null;

    // Extract metadata from transcript response
    const normalizedMetadata = this.normalizeMetadata(transcriptData || metadata || {}, 'tiktok');

    // If video download is needed, fetch video URL (no-watermark)
    let videoUrl: string | undefined;
    const hasVideoUrl =
      transcriptData &&
      (transcriptData.play || transcriptData.download_addr || transcriptData.video_url);
    if (hasVideoUrl) {
      // Prefer no-watermark URL
      videoUrl =
        transcriptData.play ||
        transcriptData.download_addr ||
        transcriptData.video_url;
    }

    // Calculate subtitle statistics
    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'tiktok',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      videoUrl: videoUrl,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: !!videoUrl, // Flag to indicate TikTok video is available for download
    };
  }

  /**
   * Fetch YouTube transcript via Free API (YouTube Video Summarizer)
   * Only called once per request
   * @param videoId YouTube video ID
   * @returns Result with transcript data or failure reason
   */
  private async fetchYouTubeTranscriptFreeAPI(
    videoId: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 15000; // 15 seconds timeout
    const MIN_TRANSCRIPT_LENGTH = 300; // Minimum transcript length (characters)
    
    // 使用配置中的主 API Host（从环境变量读取）
    const host = this.configs.youtubeTranscript?.primaryHost || 
                 this.configs.hostYouTubeTranscript || 
                 'youtube-video-summarizer-gpt-ai.p.rapidapi.com';
    const apiUrl = `https://${host}/api/v1/get-transcript-v2?video_id=${videoId}&platform=youtube`;

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      const transcript = data.transcript || data.transcription || '';
      
      // 检查是否有transcript
      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response',
        };
      }

      // 检查transcript长度（防止只有summary）
      if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
        // 如果只有summary但transcript太短，判定为失败
        if (data.summary && data.summary.length > transcript.length) {
          return {
            success: false,
            reason: 'ONLY_SUMMARY',
            message: 'Only summary available, transcript too short',
          };
        }
      }

      // ✅ 成功：返回transcript数据
      return {
        success: true,
        transcriptData: data,
        metadata: {
          title: data.title,
          author: data.author,
          summary: data.summary, // 额外bonus
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube transcript via Paid API (Youtube Transcripts)
   * Only called once per request (as fallback)
   * @param url YouTube video URL
   * @returns Result with transcript data or failure reason
   */
  private async fetchYouTubeTranscriptPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    const host = this.configs.youtubeTranscript?.backupHost || 
                 this.configs.hostYouTubeTranscript || 
                 'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com';
    const apiUrl = `https://${host}/transcribe`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const transcription = data.transcription || '';
      const errorMsg = data.error || data.message || '';

      if (!transcription || transcription.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPTION',
          message: errorMsg || 'No transcription available',
        };
      }

      // 检查特定错误信息
      const errorMessage = errorMsg.toLowerCase();
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      if (errorMessage.includes('no subtitle')) {
        return {
          success: false,
          reason: 'NO_SUBTITLE',
          message: 'Video has no subtitle available',
        };
      }

      // ✅ 成功：返回transcription数据
      return {
        success: true,
        transcriptData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube transcript via RapidAPI (Legacy method, kept for compatibility)
   * @param url YouTube video URL
   * @param host RapidAPI host
   * @returns Transcript data
   * @deprecated Use fetchYouTubeTranscriptFreeAPI or fetchYouTubeTranscriptPaidAPI instead
   */
  private async fetchYouTubeTranscript(
    url: string,
    host: string
  ): Promise<any> {
    const apiUrl = `https://${host}/transcribe`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `YouTube transcript API failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Fetch TikTok transcript via Free API (TikTok Transcriptor API3)
   * 免费API：tiktok-transcriptor-api3.p.rapidapi.com（免费配额多）
   * 只调用1次，如果失败则切换到付费API
   * @param url TikTok video URL
   * @returns Result with transcript data or failure reason
   */
  private async fetchTikTokTranscriptFreeAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 15000; // 15 seconds timeout
    const MIN_TRANSCRIPT_LENGTH = 100; // Minimum transcript length (characters) - TikTok videos are usually shorter
    
    // 使用配置中的主 API Host（从环境变量读取）
    // 免费API：tiktok-transcriptor-api3.p.rapidapi.com（免费配额多）
    const host = this.configs.tiktokTranscript?.primaryHost || 
                 this.configs.hostTikTokTranscript || 
                 'tiktok-transcriptor-api3.p.rapidapi.com';
    const apiUrl = `https://${host}/index.php`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      // TikTok API可能返回transcript、subtitle、text等字段
      const transcript = 
        data.transcript || 
        data.subtitle || 
        data.text || 
        data.transcription || 
        data.caption || 
        '';

      // 检查是否有transcript
      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response',
        };
      }

      // 检查transcript长度（TikTok视频通常较短，所以阈值较低）
      if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
        // 如果transcript太短，可能是错误响应
        if (errorMessage && errorMessage.length > 0) {
          return {
            success: false,
            reason: 'INVALID_RESPONSE',
            message: 'Transcript too short or invalid response',
          };
        }
      }

      // ✅ 成功：返回transcript数据
      return {
        success: true,
        transcriptData: data,
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok transcript via Paid API (TikTok Transcript)
   * 付费API：tiktok-transcript.p.rapidapi.com（收费便宜）
   * 只调用1次，作为免费API失败后的降级方案
   * @param url TikTok video URL
   * @returns Result with transcript data or failure reason
   */
  private async fetchTikTokTranscriptPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    // 付费API：tiktok-transcript.p.rapidapi.com（收费便宜）
    const host = this.configs.tiktokTranscript?.backupHost || 
                 this.configs.hostTikTokTranscript || 
                 'tiktok-transcript.p.rapidapi.com';
    const apiUrl = `https://${host}/transcribe-tiktok-audio`;

    try {
      // Note: This API uses form-urlencoded format
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        // 明确识别403为配额限制或权限问题
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: `HTTP 403: Forbidden - Paid API quota exceeded or access denied`,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: `HTTP 429: Rate limit exceeded`,
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMsg = data.error || data.message || '';
      const errorMessage = errorMsg.toLowerCase();
      
      // 检查配额/限额相关错误（优先检查）
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('exceeded') ||
        errorMessage.includes('disabled') ||
        errorMessage.includes('forbidden')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: errorMsg || 'Paid API quota exceeded or disabled',
        };
      }

      // 检查特定错误信息
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      if (errorMessage.includes('no subtitle') || errorMessage.includes('no transcript')) {
        return {
          success: false,
          reason: 'NO_SUBTITLE',
          message: 'Video has no subtitle available',
        };
      }

      // 数据层面失败判断：检查是否有transcription数据
      const transcription = 
        data.transcription || 
        data.transcript || 
        data.text || 
        data.subtitle || 
        '';

      if (!transcription || transcription.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPTION',
          message: errorMsg || 'No transcription available',
        };
      }

      // ✅ 成功：返回transcription数据
      return {
        success: true,
        transcriptData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok transcript via RapidAPI (Legacy method, kept for compatibility)
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Transcript data
   * @deprecated Use fetchTikTokTranscriptFreeAPI or fetchTikTokTranscriptPaidAPI instead
   */
  private async fetchTikTokTranscript(url: string, host: string): Promise<any> {
    const apiUrl = `https://${host}/index.php`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `TikTok transcript API failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Normalize metadata from different API responses
   * Handles field name differences between platforms
   * @param rawResponse Raw API response
   * @param platform Platform type
   * @returns Normalized metadata
   */
  private normalizeMetadata(
    rawResponse: any,
    platform: 'youtube' | 'tiktok'
  ): Partial<NormalizedMediaData> {
    if (platform === 'tiktok') {
      return {
        title:
          rawResponse.desc ||
          rawResponse.title ||
          rawResponse.description ||
          '',
        author:
          rawResponse.author?.nickname ||
          rawResponse.author?.uniqueId ||
          rawResponse.author ||
          '',
        likes:
          rawResponse.statistics?.digg_count ||
          rawResponse.digg_count ||
          rawResponse.likes ||
          0,
        views:
          rawResponse.statistics?.play_count ||
          rawResponse.play_count ||
          rawResponse.views ||
          0,
        shares:
          rawResponse.statistics?.share_count ||
          rawResponse.share_count ||
          rawResponse.shares ||
          0,
        duration: rawResponse.duration || rawResponse.video?.duration,
        publishedAt: rawResponse.create_time
          ? new Date(rawResponse.create_time * 1000)
          : undefined,
        thumbnailUrl:
          rawResponse.cover ||
          rawResponse.thumbnail ||
          rawResponse.video?.cover,
        sourceLang: rawResponse.language || rawResponse.lang || 'en',
      };
    } else {
      // YouTube
      return {
        title:
          rawResponse.title ||
          rawResponse.snippet?.title ||
          rawResponse.videoDetails?.title ||
          '',
        author:
          rawResponse.author ||
          rawResponse.channelTitle ||
          rawResponse.snippet?.channelTitle ||
          '',
        likes:
          rawResponse.statistics?.likeCount ||
          rawResponse.likeCount ||
          rawResponse.likes ||
          0,
        views:
          rawResponse.statistics?.viewCount ||
          rawResponse.viewCount ||
          rawResponse.views ||
          0,
        shares:
          rawResponse.statistics?.shareCount ||
          rawResponse.shareCount ||
          rawResponse.shares ||
          0,
        duration: rawResponse.duration || rawResponse.contentDetails?.duration,
        publishedAt: rawResponse.publishedAt
          ? new Date(rawResponse.publishedAt)
          : undefined,
        thumbnailUrl:
          rawResponse.thumbnail ||
          rawResponse.snippet?.thumbnails?.high?.url ||
          rawResponse.videoDetails?.thumbnail?.thumbnails?.[0]?.url,
        sourceLang: rawResponse.language || rawResponse.lang || 'en',
      };
    }
  }

  /**
   * Normalize subtitles from different API responses
   * Converts various formats to standard SRT
   * @param rawResponse Raw API response
   * @param platform Platform type
   * @returns SRT format string or null
   */
  private normalizeSubtitles(
    rawResponse: any,
    platform: 'youtube' | 'tiktok'
  ): string | null {
    if (!rawResponse) {
      return null;
    }

    // Try to find subtitle data in response
    let subtitleData: any = null;

    if (rawResponse.subtitles || rawResponse.transcript) {
      subtitleData = rawResponse.subtitles || rawResponse.transcript;
    } else if (rawResponse.text) {
      // If response has direct text, try to parse it
      subtitleData = rawResponse.text;
    } else if (Array.isArray(rawResponse)) {
      subtitleData = rawResponse;
    } else if (rawResponse.data) {
      subtitleData = rawResponse.data;
    }

    if (!subtitleData) {
      return null;
    }

    // Use SubtitleFormatter to convert to SRT
    const srtContent = SubtitleFormatter.autoConvertToSRT(subtitleData);
    return srtContent || null;
  }

  /**
   * Extract TikTok video ID from URL
   * @param url TikTok URL
   * @returns Video ID or null
   */
  private extractTikTokVideoId(url: string): string | null {
    // TikTok URL patterns:
    // https://www.tiktok.com/@username/video/1234567890
    // https://vm.tiktok.com/xxxxx/
    const patterns = [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([\w]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If no pattern matches, return the full URL as identifier
    return url;
  }

  /**
   * Fetch TikTok video download via Free API (Snap Video3)
   * Only called once per request
   * @param url TikTok video URL
   * @returns Result with video data or failure reason
   */
  private async fetchTikTokVideoDownloadFreeAPI(
    url: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 15000; // 15 seconds timeout
    
    // 使用配置中的主 API Host（从环境变量读取）
    const host = this.configs.tiktokVideo?.primaryHost || 
                 this.configs.hostTikTokDownload || 
                 'snap-video3.p.rapidapi.com';
    const apiUrl = `https://${host}/download`;

    try {
      // Create form data with URL parameter
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      // 尝试提取视频URL（可能在不同字段中）
      const videoUrl =
        data.data?.play ||
        data.data?.download_addr ||
        data.data?.video_url ||
        data.data?.video?.play ||
        data.data?.video?.download_addr ||
        data.data?.nwm_video_url ||
        data.data?.no_watermark ||
        data.play ||
        data.download_addr ||
        data.video_url ||
        data.video?.play ||
        data.video?.download_addr ||
        data.nwm_video_url ||
        data.no_watermark ||
        data.download ||
        data.url;

      // 检查是否有视频URL
      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: 'No video URL available in response',
        };
      }

      // 检查视频URL是否有效（应该是http/https链接）
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok video download via Paid API (TikTok Video No Watermark)
   * Only called once per request (as fallback)
   * @param url TikTok video URL
   * @returns Result with video data or failure reason
   */
  private async fetchTikTokVideoDownloadPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    const host = this.configs.tiktokVideo?.backupHost || 
                 this.configs.hostTikTokDownload || 
                 'tiktok-video-no-watermark2.p.rapidapi.com';
    const apiUrl = `https://${host}/`;

    try {
      // Create form data with URL parameter
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        // 明确识别403为配额限制或权限问题
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: `HTTP 403: Forbidden - Paid API quota exceeded or access denied`,
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: `HTTP 429: Rate limit exceeded`,
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMsg = data.error || data.message || '';
      const errorMessage = errorMsg.toLowerCase();
      
      // 检查配额/限额相关错误（优先检查）
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('exceeded') ||
        errorMessage.includes('disabled') ||
        errorMessage.includes('forbidden')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: errorMsg || 'Paid API quota exceeded or disabled',
        };
      }

      // 尝试提取视频URL（可能在不同字段中）
      const videoUrl =
        data.data?.play ||
        data.data?.download_addr ||
        data.data?.video_url ||
        data.data?.video?.play ||
        data.data?.video?.download_addr ||
        data.data?.nwm_video_url ||
        data.data?.no_watermark ||
        data.play ||
        data.download_addr ||
        data.video_url ||
        data.video?.play ||
        data.video?.download_addr ||
        data.nwm_video_url ||
        data.no_watermark ||
        data.download ||
        data.url;

      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: errorMsg || 'No video URL available',
        };
      }

      // 检查视频URL是否有效
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // 检查特定错误信息（使用已声明的 errorMessage）
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok video download via RapidAPI (Legacy method, kept for compatibility)
   * Uses the video download API endpoint (POST request with form data)
   * API: https://tiktok-video-no-watermark2.p.rapidapi.com/
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Video download data
   * @deprecated Use fetchTikTokVideoDownloadFreeAPI or fetchTikTokVideoDownloadPaidAPI instead
   */
  private async fetchTikTokVideoDownload(url: string, host: string): Promise<any> {
    // Call TikTok video download API using POST with form data
    const apiUrl = `https://${host}/`;
    
    // Create form data with URL parameter
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `TikTok video download API failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    
    // Log response for debugging (can be removed in production)
    console.log('TikTok video download API response:', JSON.stringify(data, null, 2));
    
    return data;
  }

  /**
   * Format YouTube URL to standard watch?v= format
   * Converts shorts/ URLs to watch?v= format for API compatibility
   * @param url YouTube URL
   * @returns Formatted URL
   */
  private formatYouTubeUrl(url: string): string {
    // Convert YouTube Shorts URL to standard watch?v= format for API compatibility
    if (url.includes('/shorts/')) {
      // Extract video ID from shorts URL
      // Support formats:
      // - https://www.youtube.com/shorts/VIDEO_ID
      // - https://youtube.com/shorts/VIDEO_ID
      // - https://m.youtube.com/shorts/VIDEO_ID
      const shortsMatch = url.match(/(?:www\.|m\.)?youtube\.com\/shorts\/([^&\n?#\/]+)/);
      if (shortsMatch && shortsMatch[1]) {
        const videoId = shortsMatch[1];
        // Convert to watch?v= format
        // Preserve the original domain (www. or m. or none)
        const domain = url.match(/https?:\/\/(?:www\.|m\.)?youtube\.com/)?.[0] || 'https://www.youtube.com';
        return `${domain}/watch?v=${videoId}`;
      }
    }
    return url;
  }

  /**
   * Extract YouTube video ID from URL
   * Supports multiple YouTube URL formats including Shorts
   * @param url YouTube URL
   * @returns Video ID or null
   */
  private extractYouTubeVideoId(url: string): string | null {
    // Format URL first (convert shorts to watch format)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#\/]+)/, // Support shorts format directly
    ];

    for (const pattern of patterns) {
      const match = formattedUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Calculate subtitle statistics (character count and line count)
   * @param srtContent SRT format subtitle content
   * @returns Statistics object
   */
  private calculateSubtitleStats(srtContent: string): {
    charCount: number;
    lineCount: number;
  } {
    if (!srtContent) {
      return { charCount: 0, lineCount: 0 };
    }

    // Count lines (subtitles entries, not including timestamps and sequence numbers)
    const lines = srtContent.split('\n');
    let subtitleLineCount = 0;
    let inSubtitleText = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, sequence numbers, and timestamps
      if (
        !trimmed ||
        /^\d+$/.test(trimmed) ||
        /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(
          trimmed
        )
      ) {
        inSubtitleText = false;
        continue;
      }
      // This is subtitle text
      if (!inSubtitleText) {
        subtitleLineCount++;
        inSubtitleText = true;
      }
    }

    // Count characters (excluding timestamps and sequence numbers)
    const textOnly = srtContent
      .split('\n')
      .filter(
        (line) =>
          line.trim() &&
          !/^\d+$/.test(line.trim()) &&
          !/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(
            line.trim()
          )
      )
      .join('\n');

    return {
      charCount: textOnly.length,
      lineCount: subtitleLineCount,
    };
  }
}

/**
 * Create RapidAPI provider with configs
 */
export function createRapidAPIProvider(
  configs: RapidAPIConfigs
): RapidAPIProvider {
  return new RapidAPIProvider(configs);
}

