# Vercel 环境变量配置方案

## 📋 概述

本文档为 Subtitle TK 在 Vercel 中配置多 API 源（主备切换）提供完整的环境变量命名方案。

---

## 🎯 设计原则

1. **清晰命名**：一眼就能看出是哪个平台、哪个功能、哪个优先级
2. **易于管理**：在 Vercel Dashboard 中易于查找和修改
3. **向后兼容**：保留现有环境变量，新增备用 API 配置
4. **安全优先**：API Key 不使用 `NEXT_PUBLIC_` 前缀（除非必需）

---

## 📝 环境变量命名规范

### 命名格式

```
{PLATFORM}_{FUNCTION}_{PRIORITY}_{CONFIG_TYPE}
```

- **PLATFORM**: `TIKTOK` | `YOUTUBE`
- **FUNCTION**: `TRANSCRIPT` | `VIDEO`
- **PRIORITY**: `PRIMARY` | `BACKUP` (或 `FREE` | `PAID`)
- **CONFIG_TYPE**: `HOST` | `KEY`

---

## 🔧 完整环境变量清单

### 一、TikTok 文案提取（Transcript）

#### 主 API（免费优先）
```env
# TikTok 文案提取 - 主 API Host
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcriptor-api3.p.rapidapi.com

# TikTok 文案提取 - 主 API Key（可选，如果与通用 Key 不同）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_KEY=your-rapidapi-key-here
```

#### 备 API（付费兜底）
```env
# TikTok 文案提取 - 备 API Host
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-transcript.p.rapidapi.com

# TikTok 文案提取 - 备 API Key（可选，如果与通用 Key 不同）
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_KEY=your-rapidapi-key-here
```

---

### 二、TikTok 视频下载（Video Download）

#### 主 API（免费优先）
```env
# TikTok 视频下载 - 主 API Host
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com

# TikTok 视频下载 - 主 API Key（可选）
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_KEY=your-rapidapi-key-here
```

#### 备 API（付费兜底）
```env
# TikTok 视频下载 - 备 API Host
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com

# TikTok 视频下载 - 备 API Key（可选）
RAPIDAPI_TIKTOK_VIDEO_BACKUP_KEY=your-rapidapi-key-here
```

---

### 三、YouTube 文案提取（Transcript）

#### 主 API（免费优先）
```env
# YouTube 文案提取 - 主 API Host
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com

# YouTube 文案提取 - 主 API Key（可选）
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_KEY=your-rapidapi-key-here
```

#### 备 API（付费兜底）
```env
# YouTube 文案提取 - 备 API Host
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com

# YouTube 文案提取 - 备 API Key（可选）
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_KEY=your-rapidapi-key-here
```

---

### 四、YouTube 视频下载（Video Download）

#### 主 API（免费优先）
```env
# YouTube 视频下载 - 主 API Host
RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST=youtube-video-and-shorts-downloader1.p.rapidapi.com

# YouTube 视频下载 - 主 API Key（可选）
RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_KEY=your-rapidapi-key-here
```

#### 备 API（付费兜底）
```env
# YouTube 视频下载 - 备 API Host
RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST=youtube-video-downloader.p.rapidapi.com

# YouTube 视频下载 - 备 API Key（可选）
RAPIDAPI_YOUTUBE_VIDEO_BACKUP_KEY=your-rapidapi-key-here
```

---

### 五、通用配置（向后兼容）

```env
# 通用 RapidAPI Key（如果所有 API 使用同一个 Key）
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key-here

# 或者使用不带 NEXT_PUBLIC_ 的版本（更安全，仅在服务端使用）
RAPIDAPI_KEY=your-rapidapi-key-here
```

---

## 📊 环境变量优先级策略

### 优先级顺序（从高到低）

1. **专用 Key**（如 `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_KEY`）
2. **通用 Key**（`RAPIDAPI_KEY` 或 `NEXT_PUBLIC_RAPIDAPI_KEY`）
3. **数据库配置**（`configs.rapidapi_key`）

### Host 优先级顺序

1. **专用 Host**（如 `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST`）
2. **数据库配置**（`configs.rapidapi_host_tiktok_transcript`）
3. **默认值**（代码中的硬编码默认值）

---

## 🎨 Vercel Dashboard 配置示例

### 在 Vercel 中添加环境变量

1. 登录 [Vercel Dashboard](https://vercel.com/)
2. 选择项目 `subtitletk.app`
3. 进入 **Settings** → **Environment Variables**
4. 按以下顺序添加变量：

#### 步骤 1: 添加通用 Key（必需）
```
Key: NEXT_PUBLIC_RAPIDAPI_KEY
Value: 558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b
Environment: Production, Preview, Development
```

#### 步骤 2: 添加 TikTok 文案提取配置
```
Key: RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST
Value: tiktok-transcriptor-api3.p.rapidapi.com
Environment: Production, Preview, Development

Key: RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST
Value: tiktok-transcript.p.rapidapi.com
Environment: Production, Preview, Development
```

#### 步骤 3: 添加 TikTok 视频下载配置
```
Key: RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST
Value: snap-video3.p.rapidapi.com
Environment: Production, Preview, Development

Key: RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST
Value: tiktok-video-no-watermark2.p.rapidapi.com
Environment: Production, Preview, Development
```

#### 步骤 4: 添加 YouTube 文案提取配置
```
Key: RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST
Value: youtube-video-summarizer-gpt-ai.p.rapidapi.com
Environment: Production, Preview, Development

Key: RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST
Value: youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com
Environment: Production, Preview, Development
```

#### 步骤 5: 添加 YouTube 视频下载配置
```
Key: RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST
Value: youtube-video-and-shorts-downloader1.p.rapidapi.com
Environment: Production, Preview, Development

Key: RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST
Value: youtube-video-downloader.p.rapidapi.com
Environment: Production, Preview, Development
```

---

## 🔄 简化方案（推荐）

如果所有 API 使用同一个 RapidAPI Key，可以只配置 Host：

### 最小配置（必需）

```env
# 通用 Key（所有 API 共用）
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key-here

# TikTok 文案提取
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcriptor-api3.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-transcript.p.rapidapi.com

# TikTok 视频下载
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com

# YouTube 文案提取
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com

# YouTube 视频下载
RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST=youtube-video-and-shorts-downloader1.p.rapidapi.com
RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST=youtube-video-downloader.p.rapidapi.com
```

**总计：9 个环境变量**（1 个 Key + 8 个 Host）

---

## 📋 环境变量清单表

| 变量名 | 用途 | 必需 | 默认值 |
|--------|------|------|--------|
| `NEXT_PUBLIC_RAPIDAPI_KEY` | 通用 RapidAPI Key | ✅ | - |
| `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST` | TikTok 文案主 API | ✅ | `tiktok-transcriptor-api3.p.rapidapi.com` |
| `RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST` | TikTok 文案备 API | ✅ | `tiktok-transcript.p.rapidapi.com` |
| `RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST` | TikTok 视频主 API | ✅ | `snap-video3.p.rapidapi.com` |
| `RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST` | TikTok 视频备 API | ✅ | `tiktok-video-no-watermark2.p.rapidapi.com` |
| `RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST` | YouTube 文案主 API | ✅ | `youtube-video-summarizer-gpt-ai.p.rapidapi.com` |
| `RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST` | YouTube 文案备 API | ✅ | `youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com` |
| `RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST` | YouTube 视频主 API | ✅ | `youtube-video-and-shorts-downloader1.p.rapidapi.com` |
| `RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST` | YouTube 视频备 API | ✅ | `youtube-video-downloader.p.rapidapi.com` |

---

## 🔐 安全建议

### 1. API Key 管理

- ✅ **推荐**：使用 `RAPIDAPI_KEY`（不带 `NEXT_PUBLIC_`），仅在服务端使用
- ⚠️ **如果必需**：使用 `NEXT_PUBLIC_RAPIDAPI_KEY`（会暴露到浏览器端）
- ❌ **不推荐**：在代码中硬编码 API Key

### 2. 环境隔离

- **Production**: 使用生产环境的 API Key
- **Preview**: 可以使用测试环境的 API Key
- **Development**: 可以使用开发环境的 API Key

### 3. 密钥轮换

- 定期轮换 API Key
- 在 Vercel Dashboard 中更新，无需修改代码
- 旧 Key 失效前，确保新 Key 已配置

---

## 🎯 代码修改建议（后续）

### 当前代码结构

代码中已经实现了 fallback 机制，但使用的是硬编码的 Host。需要修改为从环境变量读取。

### 修改位置

1. **`src/shared/services/media/rapidapi.ts`**
   - 修改 `getRapidAPIServiceWithConfigs()` 函数
   - 从环境变量读取 Host 配置

2. **`src/extensions/media/rapidapi.ts`**
   - 修改 `RapidAPIProvider` 类
   - 支持主备 Host 配置
   - 实现自动切换逻辑

### 配置结构建议

```typescript
interface RapidAPIConfigs {
  // 通用 Key
  apiKey: string;
  
  // TikTok 配置
  tiktokTranscript: {
    primaryHost: string;
    backupHost: string;
    primaryKey?: string;
    backupKey?: string;
  };
  tiktokVideo: {
    primaryHost: string;
    backupHost: string;
    primaryKey?: string;
    backupKey?: string;
  };
  
  // YouTube 配置
  youtubeTranscript: {
    primaryHost: string;
    backupHost: string;
    primaryKey?: string;
    backupKey?: string;
  };
  youtubeVideo: {
    primaryHost: string;
    backupHost: string;
    primaryKey?: string;
    backupKey?: string;
  };
}
```

---

## ✅ 实施检查清单

### Vercel 配置

- [ ] 添加 `NEXT_PUBLIC_RAPIDAPI_KEY` 或 `RAPIDAPI_KEY`
- [ ] 添加所有 TikTok 文案提取 Host
- [ ] 添加所有 TikTok 视频下载 Host
- [ ] 添加所有 YouTube 文案提取 Host
- [ ] 添加所有 YouTube 视频下载 Host
- [ ] 验证所有环境（Production/Preview/Development）都已配置

### 代码修改（后续）

- [ ] 修改 `src/shared/services/media/rapidapi.ts`
- [ ] 修改 `src/extensions/media/rapidapi.ts`
- [ ] 更新类型定义
- [ ] 测试主备切换逻辑
- [ ] 更新文档

---

## 📚 相关文档

- `ENVIRONMENT_VARIABLES.md` - 完整环境变量清单
- `TIKTOK_TRANSCRIPT_FALLBACK_IMPLEMENTATION.md` - TikTok 文案降级实现
- `TIKTOK_VIDEO_DOWNLOAD_FALLBACK_IMPLEMENTATION.md` - TikTok 视频降级实现
- `YOUTUBE_TRANSCRIPT_FALLBACK_STRATEGY.md` - YouTube 文案降级策略

---

## 🎉 总结

### 优势

1. **清晰命名**：一眼就能看出用途
2. **易于管理**：在 Vercel Dashboard 中分组清晰
3. **向后兼容**：保留现有环境变量
4. **灵活配置**：支持每个 API 使用不同的 Key（如果需要）

### 最小配置

只需配置 **9 个环境变量**（1 个 Key + 8 个 Host），即可实现完整的主备切换功能。

### 下一步

1. ✅ 在 Vercel 中配置环境变量（按本文档）
2. ⏳ 修改代码以支持从环境变量读取（后续任务）
3. ⏳ 测试主备切换功能（后续任务）

