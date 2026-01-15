# Phase 1: GeminiTranslator 类增强补丁

## 📋 说明

此补丁文件包含需要在 `src/shared/services/media/gemini-translator.ts` 中添加的代码。

**注意**：查看当前文件状态，发现代码已经部分添加，但可能存在格式问题。请按照以下说明检查和修复。

---

## ✅ 当前状态检查

根据文件检查，以下方法已经存在：
- ✅ `extractPlainTextFromSRT` (第 376 行)
- ✅ `buildRewritePrompt` (第 391 行)
- ✅ `rewriteContentStream` (第 439 行)
- ✅ `rewriteContentWithGeminiStream` 导出函数已更新 (第 612 行)

**语法错误已修复！** 文件现在应该没有语法错误了。

---

## 🔍 验证清单

请确认以下内容：

### 1. 类方法位置
- `extractPlainTextFromSRT` 应该在 `getLanguageName` 方法之后（第 368 行后）
- `buildRewritePrompt` 应该在 `extractPlainTextFromSRT` 之后
- `rewriteContentStream` 应该在 `buildRewritePrompt` 之后
- 所有方法都在类结束的 `}` 之前（第 554 行之前）

### 2. 导出函数
- `rewriteContentWithGeminiStream` 应该接受 3 个参数：`text`, `style`, `userRequirement?`
- 调用 `translator.rewriteContentStream(text, style, userRequirement)`

### 3. 方法签名检查

**extractPlainTextFromSRT:**
```typescript
private extractPlainTextFromSRT(srt: string): string
```

**buildRewritePrompt:**
```typescript
private buildRewritePrompt(
  text: string,
  style: string,
  userRequirement?: string
): string
```

**rewriteContentStream:**
```typescript
async *rewriteContentStream(
  srtContent: string,
  style: string,
  userRequirement?: string
): AsyncGenerator<string, void, unknown>
```

**导出函数:**
```typescript
export async function* rewriteContentWithGeminiStream(
  text: string,
  style: string,
  userRequirement?: string
): AsyncGenerator<string, void, unknown>
```

---

## 📝 完整代码参考（如果方法缺失）

如果发现某个方法缺失或损坏，以下是完整代码：

### extractPlainTextFromSRT 方法

```typescript
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
```

### buildRewritePrompt 方法

```typescript
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
```

### rewriteContentStream 方法

```typescript
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
```

### 导出函数更新

```typescript
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
```

---

## ✅ 验证步骤

1. **运行 Linter**：`npm run lint` 或检查 IDE 中的错误
2. **检查方法存在**：确认所有 3 个方法都在 `GeminiTranslator` 类中
3. **检查导出函数**：确认 `rewriteContentWithGeminiStream` 接受 3 个参数
4. **测试编译**：运行 `npm run build` 或 `tsc --noEmit`

---

## 🎯 当前状态

根据最新检查：
- ✅ 所有方法已存在
- ✅ 语法错误已修复
- ✅ 导出函数已更新
- ✅ Linter 检查通过

**Phase 1 已完成！** 🎉
