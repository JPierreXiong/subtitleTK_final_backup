/**
 * Content Extraction Service
 * Extracts and summarizes content from subtitles
 */

import { translateSubtitleWithGemini } from '../src/shared/services/media/gemini-translator';
import { SubtitleSegment } from './transcribe';

export interface ContentExtract {
  summary: string;
  outline: string[];
  keyPoints: string[];
  duration: number;
  language: string;
}

/**
 * Extract content from subtitles
 * This function can be called after subtitles are extracted
 * @param subtitleRaw SRT format subtitle content
 * @param targetLanguage Target language for summary (optional)
 * @returns Content extract
 */
export async function extractContent(
  subtitleRaw: string,
  targetLanguage?: string
): Promise<ContentExtract> {
  if (!subtitleRaw || subtitleRaw.trim().length === 0) {
    throw new Error('Subtitle content is empty');
  }

  // Parse SRT to segments
  const segments = parseSRTToSegments(subtitleRaw);

  // Extract text content
  const fullText = segments.map((seg) => seg.text).join(' ');

  // If target language is provided, translate first
  let contentText = fullText;
  if (targetLanguage && targetLanguage !== 'auto') {
    try {
      const translatedSRT = await translateSubtitleWithGemini(
        subtitleRaw,
        targetLanguage
      );
      contentText = parseSRTToSegments(translatedSRT)
        .map((seg) => seg.text)
        .join(' ');
    } catch (error: any) {
      console.warn('[Extract Content] Translation failed, using original text', {
        error: error.message,
      });
      // Continue with original text
    }
  }

  // Extract summary and key points using Gemini
  const summary = await extractSummary(contentText);
  const keyPoints = await extractKeyPoints(contentText);
  const outline = await extractOutline(segments);

  return {
    summary,
    outline,
    keyPoints,
    duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    language: targetLanguage || 'auto',
  };
}

/**
 * Extract summary from text using Gemini
 */
async function extractSummary(text: string): Promise<string> {
  // Use Gemini to generate summary
  // This is a simplified version - you can enhance it with more sophisticated prompts
  try {
    const { translateSubtitleWithGemini } = await import(
      '../src/shared/services/media/gemini-translator'
    );

    const prompt = `Summarize the following video content in 2-3 sentences:

${text.substring(0, 5000)} // Limit to 5000 chars

Summary:`;

    // Use Gemini's translation function as a general text generation tool
    // Note: This is a workaround - ideally you'd have a dedicated summarization function
    const summary = await translateSubtitleWithGemini(prompt, 'en');
    return summary.substring(0, 500); // Limit summary length
  } catch (error: any) {
    console.error('[Extract Content] Summary extraction failed', {
      error: error.message,
    });
    return 'Summary extraction failed';
  }
}

/**
 * Extract key points from text
 */
async function extractKeyPoints(text: string): Promise<string[]> {
  try {
    const { translateSubtitleWithGemini } = await import(
      '../src/shared/services/media/gemini-translator'
    );

    const prompt = `Extract 3-5 key points from the following video content:

${text.substring(0, 5000)}

Key points (one per line):`;

    const keyPointsText = await translateSubtitleWithGemini(prompt, 'en');
    return keyPointsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.match(/^\d+\./))
      .slice(0, 5); // Limit to 5 key points
  } catch (error: any) {
    console.error('[Extract Content] Key points extraction failed', {
      error: error.message,
    });
    return ['Key points extraction failed'];
  }
}

/**
 * Extract outline from subtitle segments
 */
function extractOutline(segments: SubtitleSegment[]): string[] {
  // Group segments by time chunks (every 30 seconds)
  const chunks: SubtitleSegment[][] = [];
  let currentChunk: SubtitleSegment[] = [];
  let currentEnd = 0;

  for (const seg of segments) {
    if (currentChunk.length === 0 || seg.start - currentEnd >= 30) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = [seg];
      currentEnd = seg.end;
    } else {
      currentChunk.push(seg);
      currentEnd = seg.end;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Extract first sentence or key phrase from each chunk
  return chunks.slice(0, 10).map((chunk, index) => {
    const text = chunk.map((seg) => seg.text).join(' ');
    const firstSentence = text.split(/[.!?]/)[0] || text.substring(0, 100);
    return `${formatTime(chunk[0].start)} - ${firstSentence.substring(0, 80)}`;
  });
}

/**
 * Format time in seconds to readable format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Parse SRT string to segments
 */
function parseSRTToSegments(srtContent: string): SubtitleSegment[] {
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
      const start = parseSRTTime(
        timeMatch[1],
        timeMatch[2],
        timeMatch[3],
        timeMatch[4]
      );
      const end = parseSRTTime(
        timeMatch[5],
        timeMatch[6],
        timeMatch[7],
        timeMatch[8]
      );

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

