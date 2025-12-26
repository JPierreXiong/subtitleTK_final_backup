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

  const rapidAPIConfigs: RapidAPIConfigs = {
    apiKey,
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


