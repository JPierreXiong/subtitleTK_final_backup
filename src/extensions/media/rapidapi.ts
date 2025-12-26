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
   * @param url YouTube video URL
   * @returns Normalized media data
   */
  private async fetchYouTubeMedia(url: string): Promise<NormalizedMediaData> {
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    const host =
      this.configs.hostYouTubeTranscript ||
      'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com';

    // Fetch transcript/subtitle using new API endpoint
    const transcriptData = await this.fetchYouTubeTranscript(formattedUrl, host).catch((error) => {
      console.warn('Failed to fetch YouTube transcript:', error);
      return null; // Allow task to continue without subtitle
    });

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'youtube')
      : null;

    // Extract metadata from transcript response if available
    const metadata = this.normalizeMetadata(transcriptData || {}, 'youtube');

    // Calculate subtitle statistics
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
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: metadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: false,
    };
  }

  /**
   * Fetch YouTube video download via RapidAPI (for video download only)
   * @param url YouTube video URL
   * @returns Normalized media data with video URL
   */
  private async fetchYouTubeVideo(url: string): Promise<NormalizedMediaData> {
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    const downloadHost =
      this.configs.hostYouTubeDownload ||
      'youtube-video-and-shorts-downloader1.p.rapidapi.com';

    // Extract video ID from URL
    const videoId = this.extractYouTubeVideoId(formattedUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // Call YouTube video download API (use formatted URL)
    const videoData = await this.fetchYouTubeVideoDownload(formattedUrl, videoId, downloadHost);

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
   * Fetch TikTok video download via RapidAPI (for video download only)
   * @param url TikTok video URL
   * @returns Normalized media data with video URL
   */
  private async fetchTikTokVideo(url: string): Promise<NormalizedMediaData> {
    const downloadHost =
      this.configs.hostTikTokDownload ||
      'tiktok-video-no-watermark2.p.rapidapi.com';

    // Extract video ID from URL
    const videoId = this.extractTikTokVideoId(url);
    if (!videoId) {
      throw new Error(`Invalid TikTok URL: ${url}`);
    }

    // Call TikTok video download API
    const videoData = await this.fetchTikTokVideoDownload(url, downloadHost);

    // Normalize metadata
    const metadata = this.normalizeMetadata(videoData, 'tiktok');

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
      isTikTokVideo: !!videoUrl,
    };
  }

  /**
   * Extract TikTok video metadata and subtitles (for subtitle extraction only)
   * @param url TikTok video URL
   * @returns Normalized media data
   */
  private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData> {
    const transcriptHost =
      this.configs.hostTikTokTranscript ||
      'tiktok-transcriptor-api3.p.rapidapi.com';

    // Fetch transcript/subtitle
    const [transcriptData] = await Promise.all([
      this.fetchTikTokTranscript(url, transcriptHost).catch((error) => {
        console.warn('Failed to fetch TikTok transcript:', error);
        return null; // Allow task to continue without subtitle
      }),
    ]);

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'tiktok')
      : null;

    // Extract metadata from transcript response
    const metadata = this.normalizeMetadata(transcriptData || {}, 'tiktok');

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
      isTikTokVideo: !!videoUrl, // Flag to indicate TikTok video is available for download
    };
  }

  /**
   * Fetch YouTube transcript via RapidAPI (new API endpoint)
   * @param url YouTube video URL
   * @param host RapidAPI host
   * @returns Transcript data
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
   * Fetch TikTok transcript via RapidAPI
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Transcript data
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
   * Fetch TikTok video download via RapidAPI
   * Uses the video download API endpoint (POST request with form data)
   * API: https://tiktok-video-no-watermark2.p.rapidapi.com/
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Video download data
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

