/**
 * RapidAPI Media Service
 * Service layer for RapidAPI media extraction
 */

import {
  createRapidAPIProvider,
  NormalizedMediaData,
  RapidAPIProvider,
  RapidAPIConfigs,
} from '@/extensions/media';
import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * Get RapidAPI service with configs
 */
export function getRapidAPIServiceWithConfigs(
  configs: Configs
): RapidAPIProvider {
  const apiKey =
    process.env.NEXT_PUBLIC_RAPIDAPI_KEY || 
    configs.rapidapi_key || 
    configs.rapidapi_media_key || 
    '';

  if (!apiKey) {
    throw new Error('RapidAPI API key is not configured');
  }

  // 从环境变量读取主备配置（优先级最高）
  const rapidAPIConfigs: RapidAPIConfigs = {
    apiKey,
    // TikTok 文案提取 - 主备配置
    tiktokTranscript: {
      primaryHost:
        process.env.RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST ||
        configs.rapidapi_host_tiktok_transcript_primary ||
        'tiktok-transcriptor-api3.p.rapidapi.com',
      backupHost:
        process.env.RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST ||
        configs.rapidapi_host_tiktok_transcript_backup ||
        'tiktok-transcript.p.rapidapi.com',
    },
    // TikTok 视频下载 - 主备配置
    tiktokVideo: {
      primaryHost:
        process.env.RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST ||
        configs.rapidapi_host_tiktok_download_primary ||
        'snap-video3.p.rapidapi.com',
      backupHost:
        process.env.RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST ||
        configs.rapidapi_host_tiktok_download_backup ||
        'tiktok-video-no-watermark2.p.rapidapi.com',
    },
    // YouTube 文案提取 - 主备配置
    youtubeTranscript: {
      primaryHost:
        process.env.RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST ||
        configs.rapidapi_host_youtube_transcript_primary ||
        'youtube-video-summarizer-gpt-ai.p.rapidapi.com',
      backupHost:
        process.env.RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST ||
        configs.rapidapi_host_youtube_transcript_backup ||
        'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com',
    },
    // YouTube 视频下载 - 主备配置
    youtubeVideo: {
      primaryHost:
        process.env.RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST ||
        configs.rapidapi_host_youtube_download_primary ||
        'snap-video3.p.rapidapi.com', // 免费API（免费配额多）
      backupHost:
        process.env.RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST ||
        configs.rapidapi_host_youtube_download_backup ||
        'cloud-api-hub-youtube-downloader.p.rapidapi.com', // 付费API（收费便宜）
    },
    // 向后兼容的旧配置
    hostTikTokDownload:
      process.env.NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_DOWNLOAD ||
      configs.rapidapi_host_tiktok_download ||
      'tiktok-video-no-watermark2.p.rapidapi.com',
    hostTikTokTranscript:
      process.env.NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_TRANSCRIPT ||
      configs.rapidapi_host_tiktok_transcript ||
      'tiktok-transcriptor-api3.p.rapidapi.com',
    hostYouTubeTranscript:
      process.env.NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT ||
      configs.rapidapi_host_youtube_transcript ||
      'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com',
    hostYouTubeDownload:
      process.env.NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_DOWNLOAD ||
      configs.rapidapi_host_youtube_download ||
      'youtube-video-and-shorts-downloader1.p.rapidapi.com',
  };

  return createRapidAPIProvider(rapidAPIConfigs);
}

/**
 * Global RapidAPI service instance
 */
let rapidAPIService: RapidAPIProvider | null = null;

/**
 * Get RapidAPI service instance
 */
export async function getRapidAPIService(): Promise<RapidAPIProvider> {
  if (!rapidAPIService) {
    const configs = await getAllConfigs();
    rapidAPIService = getRapidAPIServiceWithConfigs(configs);
  }
  return rapidAPIService;
}

/**
 * Fetch media data from RapidAPI
 * @param url Video URL (YouTube or TikTok)
 * @param outputType Output type: 'subtitle' for subtitle extraction, 'video' for video download
 * @returns Normalized media data
 */
export async function fetchMediaFromRapidAPI(
  url: string,
  outputType: 'subtitle' | 'video' = 'subtitle'
): Promise<NormalizedMediaData> {
  const service = await getRapidAPIService();
  return await service.fetchMedia(url, outputType);
}


