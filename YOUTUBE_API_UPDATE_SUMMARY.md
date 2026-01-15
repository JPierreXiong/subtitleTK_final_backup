# YouTube 字幕 API 更新总结

## ✅ 已完成的更新

### 1. API 端点更新

**旧 API（收费）**：
- Host: `youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com`
- Endpoint: `/transcribe`
- 参数: `{"url": "..."}`

**新 API（免费）**：
- Host: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`
- Endpoint: `/transcript`
- 参数: `{"videoUrl": "...", "langCode": "en"}`

---

## 📝 代码更新位置

### 1. `src/extensions/media/rapidapi.ts`

**更新内容**：
- ✅ `fetchYouTubeTranscriptPaidAPI` 方法已更新
- ✅ API URL 从 `/transcribe` 改为 `/transcript`
- ✅ 请求参数从 `{url}` 改为 `{videoUrl, langCode: 'en'}`
- ✅ 响应字段提取支持多种格式：`transcript`, `transcription`, `text`, `content`
- ✅ 默认 host 已更新为新免费 API

**关键代码**：
```typescript
const host = this.configs.youtubeTranscript?.backupHost || 
             this.configs.hostYouTubeTranscript || 
             'ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com';
const apiUrl = `https://${host}/transcript`;

body: JSON.stringify({ 
  videoUrl: url,
  langCode: 'en' // 默认英语
})
```

### 2. `src/shared/services/media/rapidapi.ts`

**更新内容**：
- ✅ `backupHost` 默认值已更新
- ✅ `hostYouTubeTranscript` 默认值已更新

---

## 🔧 环境变量配置

### 可选环境变量（如果已设置，需要更新）

如果您的 `.env` 或 `.env.local` 文件中有以下环境变量，请更新：

```bash
# 旧值（收费 API）
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT=youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com

# 新值（免费 API）
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
```

**注意**：如果没有设置这些环境变量，代码会使用新的默认值，无需手动更新。

---

## 🔍 API 参数说明

### 新 API 参数格式

```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "langCode": "en"
}
```

**参数说明**：
- `videoUrl`: YouTube 视频完整 URL（必需）
- `langCode`: 语言代码（可选，默认 "en"）
  - 支持的值：`en`, `zh`, `es`, `fr`, `de`, `ja`, `ko` 等
  - 如果视频是其他语言，可以尝试设置为对应语言代码

### 响应格式

新 API 可能返回以下字段之一：
- `transcript` (优先)
- `transcription`
- `text`
- `content`

代码已支持自动检测这些字段。

---

## ✅ 验证清单

- [x] API host 已更新为新免费 API
- [x] API endpoint 从 `/transcribe` 改为 `/transcript`
- [x] 请求参数格式已更新（`videoUrl` + `langCode`）
- [x] 响应字段提取支持多种格式
- [x] 默认配置已更新
- [x] 环境变量配置说明已提供
- [x] Linter 检查通过

---

## 🧪 测试建议

1. **测试 YouTube 视频字幕提取**：
   - 使用一个公开的 YouTube 视频 URL
   - 验证字幕提取是否正常工作
   - 检查返回的字幕内容

2. **测试不同语言**：
   - 如果视频是中文，可以尝试设置 `langCode: 'zh'`
   - 验证语言检测和提取是否正常

3. **测试错误处理**：
   - 测试无效 URL
   - 测试无字幕的视频
   - 验证错误消息是否友好

---

## 📊 成本优化

**更新前**：
- 使用收费 API，每次调用产生费用

**更新后**：
- 使用免费 API，降低运营成本
- 保持相同的功能和用户体验

---

**所有更新已完成！** 🎉
