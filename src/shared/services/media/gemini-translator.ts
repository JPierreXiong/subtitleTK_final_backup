/**
 * Gemini Translation Service
 * Translates SRT subtitle content using Google Gemini API
 */

import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * Gemini translation configuration
 */
export interface GeminiTranslationConfigs {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Translation result interface
 */
export interface TranslationResult {
  translatedText: string;
  charCount: number;
  estimatedTokens?: number;
}

/**
 * Gemini Translator class
 * Handles SRT subtitle translation using Gemini API
 */
export class GeminiTranslator {
  private configs: GeminiTranslationConfigs;
  private readonly DEFAULT_MODEL = 'gemini-1.5-flash';
  private readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly MAX_CHUNK_SIZE = 5000; // Characters per chunk (conservative limit)
  private readonly DEFAULT_TIMEOUT = 120000; // 2 minutes

  constructor(configs: GeminiTranslationConfigs) {
    this.configs = configs;
  }

  /**
   * Translate SRT subtitle content to target language
   * @param srtContent SRT format subtitle content
   * @param targetLanguage Target language code (e.g., 'zh-CN', 'en', 'es')
   * @returns Translated SRT content
   */
  async translateSubtitle(
    srtContent: string,
    targetLanguage: string
  ): Promise<string> {
    if (!srtContent || !srtContent.trim()) {
      throw new Error('Subtitle content is empty');
    }

    if (!targetLanguage) {
      throw new Error('Target language is required');
    }

    // Check if content needs chunking
    const charCount = srtContent.length;
    if (charCount > this.MAX_CHUNK_SIZE) {
      // Use chunked translation
      return await this.translateSubtitleChunked(srtContent, targetLanguage);
    }

    // Single request translation
    return await this.translateSubtitleSingle(srtContent, targetLanguage);
  }

  /**
   * Translate subtitle in a single request (for short content)
   * @param srtContent SRT format subtitle content
   * @param targetLanguage Target language code
   * @returns Translated SRT content
   */
  private async translateSubtitleSingle(
    srtContent: string,
    targetLanguage: string
  ): Promise<string> {
    const model = this.configs.model || this.DEFAULT_MODEL;
    const apiKey = this.configs.apiKey;
    const baseUrl = this.configs.baseUrl || this.DEFAULT_BASE_URL;

    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const prompt = this.buildTranslationPrompt(srtContent, targetLanguage);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent translation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192, // Sufficient for subtitle translation
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();

      // Extract translated text from response
      const translatedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!translatedText) {
        throw new Error('No translation result from Gemini API');
      }

      // Clean up the response (remove any markdown formatting or explanations)
      return this.cleanTranslationResult(translatedText);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Translation request timed out');
      }
      throw error;
    }
  }

  /**
   * Translate subtitle in chunks (for long content)
   * Preserves SRT structure and timestamps
   * @param srtContent SRT format subtitle content
   * @param targetLanguage Target language code
   * @returns Translated SRT content
   */
  private async translateSubtitleChunked(
    srtContent: string,
    targetLanguage: string
  ): Promise<string> {
    // Split SRT into chunks by subtitle entries (preserving timestamps)
    const chunks = this.splitSRTIntoChunks(srtContent, this.MAX_CHUNK_SIZE);

    if (chunks.length === 0) {
      throw new Error('Failed to split subtitle into chunks');
    }

    // Translate each chunk
    const translatedChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const translatedChunk = await this.translateSubtitleSingle(
          chunk,
          targetLanguage
        );
        translatedChunks.push(translatedChunk);

        // Add small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to translate chunk ${i + 1}:`, error);
        // If chunk translation fails, keep original chunk
        translatedChunks.push(chunk);
      }
    }

    // Combine translated chunks
    return translatedChunks.join('\n\n');
  }

  /**
   * Split SRT content into chunks while preserving subtitle structure
   * @param srtContent SRT format content
   * @param maxChunkSize Maximum characters per chunk
   * @returns Array of SRT chunks
   */
  private splitSRTIntoChunks(
    srtContent: string,
    maxChunkSize: number
  ): string[] {
    const lines = srtContent.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentChunkSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // Check if adding this line would exceed chunk size
      if (
        currentChunkSize + lineSize > maxChunkSize &&
        currentChunk.length > 0
      ) {
        // Save current chunk and start new one
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentChunkSize = 0;
      }

      currentChunk.push(line);
      currentChunkSize += lineSize;

      // If we encounter an empty line after a subtitle entry, it's a good break point
      if (
        line.trim() === '' &&
        currentChunk.length > 3 &&
        currentChunkSize > maxChunkSize * 0.7
      ) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentChunkSize = 0;
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Build translation prompt for Gemini
   * @param srtContent SRT format content
   * @param targetLanguage Target language code
   * @returns Formatted prompt
   */
  private buildTranslationPrompt(
    srtContent: string,
    targetLanguage: string
  ): string {
    const languageName = this.getLanguageName(targetLanguage);

    return `You are an expert subtitle translator. Translate the following SRT content into ${languageName} (${targetLanguage}).

Rules:
1. Keep the exact index numbers and timestamp format (e.g., "1\\n00:00:00,000 --> 00:00:01,000").
2. Only translate the text content between timestamps.
3. Do not include any introductory or concluding remarks.
4. Maintain the original line breaks and empty lines between subtitle entries.
5. Return only the SRT format text, no explanations or additional text.

SRT content:
${srtContent}`;
  }

  /**
   * Clean translation result (remove markdown, explanations, etc.)
   * More robust cleaning logic to handle various edge cases
   * @param translatedText Raw translation result from Gemini
   * @returns Cleaned SRT content
   */
  private cleanTranslationResult(translatedText: string): string {
    let cleaned = translatedText.trim();

    // Remove markdown code blocks (more robust pattern matching)
    // Handle various formats: ```srt, ```, ```text, etc.
    cleaned = cleaned.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
    cleaned = cleaned.replace(/```[a-z]*\n?/g, '').replace(/\n?```/g, '');

    // Remove common prefixes/suffixes that Gemini might add
    cleaned = cleaned.replace(
      /^(Here is|Here's|The translated|Translation:|Translated SRT:|Here's the translation:|The following is|Below is)\s*/i,
      ''
    );
    cleaned = cleaned.replace(
      /\s*(That's|This is|End of translation|Translation complete|Done)\.?\s*$/i,
      ''
    );

    // Remove any leading/trailing whitespace and newlines
    cleaned = cleaned.trim();

    // Remove any explanatory text before the first subtitle entry
    // Look for the pattern: number followed by timestamp
    const firstSubtitleMatch = cleaned.match(
      /(\d+\s*\n\s*\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3})/
    );
    if (firstSubtitleMatch) {
      const firstIndex = cleaned.indexOf(firstSubtitleMatch[0]);
      if (firstIndex > 0) {
        // Remove everything before the first subtitle entry
        cleaned = cleaned.substring(firstIndex);
      }
    }

    // Ensure it starts with a number (SRT sequence)
    if (!/^\d+/.test(cleaned.trim())) {
      // Try to find the first subtitle entry with more flexible pattern
      const firstEntryMatch = cleaned.match(
        /(\d+\s*\n\s*\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3})/
      );
      if (firstEntryMatch) {
        cleaned = cleaned.substring(cleaned.indexOf(firstEntryMatch[0]));
      }
    }

    // Remove any trailing explanatory text after the last subtitle entry
    // Look for patterns that indicate the end of SRT content
    const lines = cleaned.split('\n');
    const lastSubtitleIndex = lines.findLastIndex((line) =>
      /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(line)
    );

    if (lastSubtitleIndex >= 0 && lastSubtitleIndex < lines.length - 1) {
      // Check if there's explanatory text after the last subtitle
      const remainingLines = lines.slice(lastSubtitleIndex + 1);
      const hasExplanatoryText = remainingLines.some(
        (line) =>
          line.trim() &&
          !/^\d+$/.test(line.trim()) &&
          !/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(
            line.trim()
          )
      );

      if (hasExplanatoryText) {
        // Keep only up to the last subtitle entry + its text
        cleaned = lines.slice(0, lastSubtitleIndex + 2).join('\n');
      }
    }

    return cleaned.trim();
  }

  /**
   * Get language name from language code
   * @param langCode Language code (e.g., 'zh-CN', 'en')
   * @returns Language name
   */
  private getLanguageName(langCode: string): string {
    const languageMap: Record<string, string> = {
      'en': 'English',
      'zh-CN': 'Simplified Chinese',
      'zh': 'Chinese',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'it': 'Italian',
      'ar': 'Arabic',
      'hi': 'Hindi',
    };

    return languageMap[langCode] || langCode;
  }

  /**
   * Extract plain text from SRT format (remove timestamps and sequence numbers)
   * This saves tokens and allows Gemini to focus on content semantics
   * @param srt SRT format content
   * @returns Plain text content
   */
  private extractPlainTextFromSRT(srt: string): string {
    return srt
      .replace(/\d+\n\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, '') // Remove timestamps
      .replace(/^\d+$/gm, '') // Remove sequence numbers
      .replace(/\n{2,}/g, '\n') // Compress multiple newlines
      .trim();
  }

  /**
   * Build rewrite prompt with style and optional user requirement
   * @param text Plain text content (extracted from SRT)
   * @param style Rewrite style preset
   * @param userRequirement Optional user-specific requirement (highest priority)
   * @returns Formatted prompt for Gemini
   */
  private buildRewritePrompt(
    text: string,
    style: string,
    userRequirement?: string
  ): string {
    const styleConfigs: Record<string, string> = {
      tiktok:
        'TikTok 爆款模式：前3秒黄金钩子，强节奏感，高频情绪词，语言极其口语化、带情绪，适配短视频快节奏。',
      youtube:
        'YouTube 深度模式：结构化内容，长线逻辑，干货密度大，保持逻辑清晰、适合做深度拆解或长视频脚本。',
      redbook:
        '小红书种草模式：语气亲切，多使用 Emoji，重点在于引导收藏、点赞和共鸣。',
      emotional:
        '情感共鸣模式：慢节奏、金句频出，适合情感类账号，用慢节奏、金句频出的方式重写文案。',
      script:
        '专业分镜模式：直接输出带场景建议（视觉+听觉）的专业分镜脚本。',
    };

    const baseInstructions = styleConfigs[style] || styleConfigs.tiktok;

    // Core logic: User requirement has highest priority
    const customSection = userRequirement?.trim()
      ? `【用户特定要求】（优先级最高）：请务必满足以下要求：${userRequirement.trim()}。如果用户需求与预设风格有冲突，请以用户需求为准。`
      : '请按照预设风格进行自由发挥。';

    return `你是一个顶级的短视频文案专家。
你的任务是重写下方的原始文案。

【核心指导准则】：
1. ${baseInstructions}
2. 严禁使用 AI 常用口癖（如"总而言之"、"首先其次"、"综上所述"），多使用反问句和非正式的口语表达，确保文案看起来像是真人创作。
3. ${customSection}

【原始文案】：
"""
${text}
"""

直接输出改写后的最终脚本，保持结构清晰。不要输出任何解释性文字、前缀或后缀说明。`;
  }

  /**
   * Rewrite content using Gemini with streaming support
   * @param srtContent Original content (can be SRT or plain text)
   * @param style Rewrite style preset
   * @param userRequirement Optional user-specific requirement
   * @returns AsyncGenerator that yields text chunks
   */
  async *rewriteContentStream(
    srtContent: string,
    style: string,
    userRequirement?: string
  ): AsyncGenerator<string, void, unknown> {
    // Extract plain text from SRT (if it's SRT format)
    const plainText = this.extractPlainTextFromSRT(srtContent);
    const prompt = this.buildRewritePrompt(plainText, style, userRequirement);

    const model = this.configs.model || this.DEFAULT_MODEL;
    const apiKey = this.configs.apiKey;
    const baseUrl = this.configs.baseUrl || this.DEFAULT_BASE_URL;

    // Use stream endpoint for streaming
    const url = `${baseUrl}/models/${model}:streamGenerateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.8, // Higher temperature for more creative rewriting
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse streaming JSON responses
        // Gemini stream format: multiple JSON objects separated by newlines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            // Handle different stream formats
            let jsonData: any;
            if (line.startsWith('data: ')) {
              // SSE format
              jsonData = JSON.parse(line.slice(6));
            } else {
              // Direct JSON
              jsonData = JSON.parse(line);
            }

            // Extract text from Gemini response
            const candidates = jsonData.candidates || [];
            for (const candidate of candidates) {
              const content = candidate.content;
              if (content?.parts) {
                for (const part of content.parts) {
                  if (part.text) {
                    yield part.text;
                  }
                }
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines (may be empty or incomplete)
            if (parseError instanceof SyntaxError) {
              continue;
            }
            throw parseError;
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Rewrite request timed out');
      }
      console.error('[Gemini] Rewrite Stream Error:', error);
      throw error;
    }
  }
}

/**
 * Get Gemini translator service with configs
 */
export function getGeminiTranslatorWithConfigs(
  configs: Configs
): GeminiTranslator {
  const apiKey =
    process.env.GEMINI_API_KEY || configs.gemini_api_key || '';

  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  return new GeminiTranslator({
    apiKey,
    model: configs.gemini_model || 'gemini-1.5-flash',
    baseUrl: process.env.GEMINI_BASE_URL,
  });
}

/**
 * Global Gemini translator instance
 */
let geminiTranslator: GeminiTranslator | null = null;

/**
 * Get Gemini translator service instance
 */
export async function getGeminiTranslator(): Promise<GeminiTranslator> {
  if (!geminiTranslator) {
    const configs = await getAllConfigs();
    geminiTranslator = getGeminiTranslatorWithConfigs(configs);
  }
  return geminiTranslator;
}

/**
 * Translate subtitle using Gemini
 * @param srtContent SRT format subtitle content
 * @param targetLanguage Target language code
 * @returns Translated SRT content
 */
export async function translateSubtitleWithGemini(
  srtContent: string,
  targetLanguage: string
): Promise<string> {
  const translator = await getGeminiTranslator();
  return await translator.translateSubtitle(srtContent, targetLanguage);
}

/**
 * Rewrite content using Gemini with streaming support
 * @param text Original text content (can be SRT or plain text)
 * @param style Rewrite style preset
 * @param userRequirement Optional user-specific requirement (highest priority)
 * @returns AsyncGenerator that yields text chunks
 */
export async function* rewriteContentWithGeminiStream(
  text: string,
  style: string,
  userRequirement?: string
): AsyncGenerator<string, void, unknown> {
  const translator = await getGeminiTranslator();
  yield* translator.rewriteContentStream(text, style, userRequirement);
}
