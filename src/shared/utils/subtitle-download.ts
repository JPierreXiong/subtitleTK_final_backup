/**
 * Subtitle Download Utilities
 * Provides functions to download subtitles in various formats (SRT, TXT, VTT)
 * All processing happens in the browser, no server-side file generation needed
 */

/**
 * Sanitize filename for cross-platform compatibility
 * Removes illegal characters, handles emojis, and enforces length limits
 * @param author Author name (e.g., TikTok username)
 * @param title Video title/description
 * @param ext File extension (without dot)
 * @returns Sanitized filename
 */
export function sanitizeFileName(
  author: string | null | undefined,
  title: string | null | undefined,
  ext: string
): string {
  // 1. 组合原始名称，设置默认值
  const safeAuthor = (author || 'User').trim();
  const safeTitle = (title || 'Video').trim();
  const rawName = `${safeAuthor}_${safeTitle}`.trim();

  // 2. 移除 Windows 和 POSIX 非法字符：\ / : * ? " < > |
  // 同时移除控制字符 (0-31) 和部分扩展 ASCII (128-159)
  let cleanName = rawName.replace(/[\\/:*?"<>|\x00-\x1f\x80-\x9f]/g, '_');

  // 3. 移除可能导致问题的 Unicode 符号（保留基本字符和常见符号）
  // 移除零宽字符和部分特殊符号
  cleanName = cleanName.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // 4. 压缩连续的空格、下划线或点号
  cleanName = cleanName.replace(/[\s_.]+/g, '_');

  // 5. 处理文件名长度 (限制在 120 字符以内，留出路径余量)
  const MAX_LENGTH = 120;
  if (cleanName.length > MAX_LENGTH) {
    // 尝试保留作者名，截断标题
    if (safeAuthor.length < MAX_LENGTH - 10) {
      const titlePart = safeTitle.substring(0, MAX_LENGTH - safeAuthor.length - 1);
      cleanName = `${safeAuthor}_${titlePart}`;
    } else {
      cleanName = cleanName.substring(0, MAX_LENGTH);
    }
  }

  // 6. 移除首尾的空格、点号或下划线（Windows 下点号结尾的文件名会有问题）
  cleanName = cleanName.replace(/^[.\s_]+|[.\s_]+$/g, '');

  // 7. 兜底策略：如果清洗后变为空，返回默认名称
  if (!cleanName || cleanName.length === 0) {
    cleanName = 'video';
  }

  return `${cleanName}.${ext}`;
}

/**
 * Download subtitle as SRT file
 * @param srtContent SRT format content
 * @param filename Filename (without extension)
 */
export function downloadSRT(srtContent: string, filename: string = 'subtitle'): void {
  if (!srtContent || srtContent.trim().length === 0) {
    throw new Error('Subtitle content is empty');
  }

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.srt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download subtitle as TXT file (plain text, no timestamps)
 * Extracts only the text content from SRT format
 * @param srtContent SRT format content
 * @param filename Filename (without extension)
 */
export function downloadTXT(srtContent: string, filename: string = 'subtitle'): void {
  if (!srtContent || srtContent.trim().length === 0) {
    throw new Error('Subtitle content is empty');
  }

  // Parse SRT and extract only text (remove timestamps and sequence numbers)
  const lines = srtContent.split('\n');
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines, sequence numbers, and timestamps
    if (
      !line ||
      /^\d+$/.test(line) || // Sequence number
      /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(line) // Timestamp
    ) {
      continue;
    }

    // This is subtitle text
    textLines.push(line);
  }

  const textContent = textLines.join('\n');
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download subtitle as VTT file (WebVTT format)
 * Converts SRT to VTT format
 * @param srtContent SRT format content
 * @param filename Filename (without extension)
 */
export function downloadVTT(srtContent: string, filename: string = 'subtitle'): void {
  if (!srtContent || srtContent.trim().length === 0) {
    throw new Error('Subtitle content is empty');
  }

  // Convert SRT to VTT
  // VTT format: WEBVTT header + same content but with . instead of , in timestamps
  let vttContent = 'WEBVTT\n\n';
  
  // Replace SRT timestamp format (00:00:00,000) with VTT format (00:00:00.000)
  vttContent += srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');

  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.vtt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download subtitle in multiple formats
 * @param srtContent SRT format content
 * @param filename Base filename (without extension)
 * @param formats Array of formats to download: 'srt' | 'txt' | 'vtt'
 */
export function downloadSubtitleFormats(
  srtContent: string,
  filename: string = 'subtitle',
  formats: ('srt' | 'txt' | 'vtt')[] = ['srt']
): void {
  formats.forEach((format) => {
    try {
      switch (format) {
        case 'srt':
          downloadSRT(srtContent, filename);
          break;
        case 'txt':
          downloadTXT(srtContent, filename);
          break;
        case 'vtt':
          downloadVTT(srtContent, filename);
          break;
      }
    } catch (error: any) {
      console.error(`Failed to download ${format} format:`, error);
    }
  });
}

/**
 * Get subtitle text content (plain text, no timestamps)
 * Useful for displaying or copying text
 * @param srtContent SRT format content
 * @returns Plain text content
 */
export function getSubtitleText(srtContent: string): string {
  if (!srtContent || srtContent.trim().length === 0) {
    return '';
  }

  const lines = srtContent.split('\n');
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines, sequence numbers, and timestamps
    if (
      !line ||
      /^\d+$/.test(line) ||
      /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(line)
    ) {
      continue;
    }

    textLines.push(line);
  }

  return textLines.join('\n');
}
