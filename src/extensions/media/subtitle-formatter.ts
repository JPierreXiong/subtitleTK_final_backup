/**
 * Subtitle format converter utilities
 * Converts various subtitle formats to standard SRT format
 */

export interface SubtitleSegment {
  start: number; // Start time in seconds
  duration: number; // Duration in seconds
  text: string; // Subtitle text
}

export interface SubtitleJSON {
  start?: number;
  duration?: number;
  text?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Subtitle formatter utility class
 * Converts various subtitle formats to standard SRT format
 */
export class SubtitleFormatter {
  /**
   * Convert JSON array to SRT format
   * @param data Array of subtitle segments with start, duration, text
   * @returns SRT format string
   */
  static jsonToSRT(data: SubtitleSegment[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const srtLines: string[] = [];

    data.forEach((segment, index) => {
      const sequence = index + 1;
      const startTime = this.formatTimestamp(segment.start || 0);
      const endTime = this.formatTimestamp(
        (segment.start || 0) + (segment.duration || 0)
      );
      const text = segment.text || '';

      srtLines.push(`${sequence}`);
      srtLines.push(`${startTime} --> ${endTime}`);
      srtLines.push(text);
      srtLines.push(''); // Empty line between segments
    });

    return srtLines.join('\n');
  }

  /**
   * Convert VTT format to SRT format
   * @param vttContent VTT format string
   * @returns SRT format string
   */
  static vttToSRT(vttContent: string): string {
    if (!vttContent || typeof vttContent !== 'string') {
      return '';
    }

    // Remove VTT header and metadata
    let content = vttContent
      .replace(/WEBVTT[\s\S]*?\n\n/g, '')
      .replace(/NOTE[\s\S]*?\n\n/g, '');

    const lines = content.split('\n');
    const srtLines: string[] = [];
    let sequence = 1;
    let currentSegment: {
      start?: string;
      end?: string;
      text?: string[];
    } = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        if (currentSegment.start && currentSegment.text) {
          srtLines.push(`${sequence}`);
          srtLines.push(
            `${this.vttTimeToSRT(currentSegment.start)} --> ${this.vttTimeToSRT(currentSegment.end || currentSegment.start)}`
          );
          srtLines.push(currentSegment.text.join('\n'));
          srtLines.push('');
          sequence++;
          currentSegment = {};
        }
        continue;
      }

      // Check if line is a timestamp (VTT format: 00:00:00.000 --> 00:00:05.000)
      const timestampMatch = line.match(
        /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/
      );
      if (timestampMatch) {
        currentSegment.start = timestampMatch[1];
        currentSegment.end = timestampMatch[2];
        currentSegment.text = [];
        continue;
      }

      // Text content
      if (currentSegment.start) {
        if (!currentSegment.text) {
          currentSegment.text = [];
        }
        currentSegment.text.push(line);
      }
    }

    // Handle last segment
    if (currentSegment.start && currentSegment.text) {
      srtLines.push(`${sequence}`);
      srtLines.push(
        `${this.vttTimeToSRT(currentSegment.start)} --> ${this.vttTimeToSRT(currentSegment.end || currentSegment.start)}`
      );
      srtLines.push(currentSegment.text.join('\n'));
    }

    return srtLines.join('\n');
  }

  /**
   * Format timestamp from seconds to SRT format (HH:MM:SS,mmm)
   * @param seconds Time in seconds
   * @returns SRT format timestamp string
   */
  static formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Convert VTT timestamp to SRT timestamp format
   * VTT: 00:00:00.000 or 00:00:00,000
   * SRT: 00:00:00,000
   * @param vttTime VTT format timestamp
   * @returns SRT format timestamp
   */
  private static vttTimeToSRT(vttTime: string): string {
    return vttTime.replace('.', ',');
  }

  /**
   * Detect subtitle format and convert to SRT
   * @param content Subtitle content in unknown format
   * @returns SRT format string or null if cannot parse
   */
  static autoConvertToSRT(content: any): string | null {
    if (!content) {
      return null;
    }

    // If it's already a string, try to detect format
    if (typeof content === 'string') {
      // Check if it's VTT format
      if (content.includes('WEBVTT') || content.match(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/)) {
        return this.vttToSRT(content);
      }
      // Check if it's already SRT format
      if (content.match(/\d+\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/)) {
        return content;
      }
      return null;
    }

    // If it's an array, assume JSON format
    if (Array.isArray(content)) {
      // Try to convert as JSON subtitle array
      try {
        const segments: SubtitleSegment[] = content.map((item) => ({
          start: item.start || item.startTime || 0,
          duration: item.duration || item.dur || 0,
          text: item.text || item.content || '',
        }));
        return this.jsonToSRT(segments);
      } catch (error) {
        console.error('Failed to convert JSON subtitle:', error);
        return null;
      }
    }

    // If it's an object, try to extract subtitle data
    if (typeof content === 'object') {
      // Check if it has a subtitles array
      if (content.subtitles && Array.isArray(content.subtitles)) {
        return this.jsonToSRT(content.subtitles);
      }
      // Check if it has a transcript array
      if (content.transcript && Array.isArray(content.transcript)) {
        return this.jsonToSRT(content.transcript);
      }
    }

    return null;
  }
}


