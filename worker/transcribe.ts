/**
 * ASR Transcription Service
 * Converts audio to subtitles
 * Priority: RapidAPI subtitle (if available) > Cloud ASR API
 */

export interface SubtitleSegment {
  start: number; // Start time in seconds
  end: number; // End time in seconds
  text: string; // Subtitle text
}

/**
 * Format subtitles to SRT format
 * @param segments Subtitle segments
 * @returns SRT format string
 */
export function formatSubtitlesToSRT(segments: SubtitleSegment[]): string {
  if (!segments || segments.length === 0) {
    return '';
  }

  return segments
    .map((seg, index) => {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      return `${index + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
}

/**
 * Format timestamp to SRT format (HH:MM:SS,mmm)
 * @param seconds Time in seconds
 * @returns Formatted timestamp string
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Transcribe audio using cloud ASR API (fallback)
 * This is a placeholder - implement based on your ASR provider
 * @param audioPath Path to audio file
 * @returns Subtitle segments
 */
export async function transcribeAudioWithCloudAPI(
  audioPath: string
): Promise<SubtitleSegment[]> {
  // TODO: Implement cloud ASR API integration
  // Options:
  // - Google Cloud Speech-to-Text
  // - AWS Transcribe
  // - Azure Speech Services
  // - AssemblyAI
  // - Deepgram
  
  throw new Error(
    'Cloud ASR API not implemented. Please use RapidAPI subtitle extraction or implement a cloud ASR provider.'
  );
}

/**
 * Parse RapidAPI subtitle response to segments
 * RapidAPI may return various formats, this normalizes them
 * @param subtitleData Subtitle data from RapidAPI (could be JSON array, SRT string, etc.)
 * @returns Subtitle segments
 */
export function parseRapidAPISubtitle(
  subtitleData: any
): SubtitleSegment[] {
  if (!subtitleData) {
    return [];
  }

  // If it's already an array of segments
  if (Array.isArray(subtitleData)) {
    return subtitleData.map((item: any) => ({
      start: item.start || item.startTime || 0,
      end: item.end || item.endTime || item.start + (item.duration || 0),
      text: item.text || item.content || '',
    }));
  }

  // If it's a string (SRT format), parse it
  if (typeof subtitleData === 'string') {
    return parseSRTString(subtitleData);
  }

  // If it's an object with segments
  if (subtitleData.segments && Array.isArray(subtitleData.segments)) {
    return subtitleData.segments.map((item: any) => ({
      start: item.start || 0,
      end: item.end || item.start + (item.duration || 0),
      text: item.text || '',
    }));
  }

  return [];
}

/**
 * Parse SRT string to segments
 * @param srtContent SRT format string
 * @returns Subtitle segments
 */
function parseSRTString(srtContent: string): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Skip sequence number (first line)
    const timeLine = lines[1];
    const text = lines.slice(2).join('\n').trim();

    // Parse timestamp: "00:00:00,000 --> 00:00:01,000"
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (timeMatch && text) {
      const start = parseSRTTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const end = parseSRTTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

      segments.push({
        start,
        end,
        text,
      });
    }
  }

  return segments;
}

/**
 * Parse SRT time to seconds
 */
function parseSRTTime(
  hours: string,
  minutes: string,
  seconds: string,
  millis: string
): number {
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(millis) / 1000
  );
}



