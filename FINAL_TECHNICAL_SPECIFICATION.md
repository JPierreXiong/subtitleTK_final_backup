# 最终技术规格说明

## 📋 概述

本文档基于所有澄清和确认，整理出完整的技术实现规格，作为开发的唯一参考标准。

---

## 一、RapidAPI 配置细节

### 1.1 API端点配置

#### TikTok视频下载
```bash
GET https://tiktok-download-video1.p.rapidapi.com/photoSearch?keywords=dog&region=JP
Headers:
  x-rapidapi-host: tiktok-download-video1.p.rapidapi.com
  x-rapidapi-key: {RAPIDAPI_KEY}
```

**注意**: 这个端点看起来是搜索API，可能需要确认TikTok视频下载的正确端点。

#### YouTube字幕提取
```bash
GET https://youtube-transcriptor.p.rapidapi.com/transcript?video_id={VIDEO_ID}&lang=en
Headers:
  x-rapidapi-host: youtube-transcriptor.p.rapidapi.com
  x-rapidapi-key: {RAPIDAPI_KEY}
```

**返回数据**: 应该包含字幕文本和时间戳信息。

#### TikTok字幕提取
```bash
POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php
Headers:
  Content-Type: application/json
  x-rapidapi-host: tiktok-transcriptor-api3.p.rapidapi.com
  x-rapidapi-key: {RAPIDAPI_KEY}
Body:
  {
    "url": "https://www.tiktok.com/@username/video/1234567890"
  }
```

**返回数据**: 应该包含字幕文本和时间戳信息。

### 1.2 环境变量配置

```env
# RapidAPI配置
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key-here
NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_DOWNLOAD=tiktok-download-video1.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT=youtube-transcriptor.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_TRANSCRIPT=tiktok-transcriptor-api3.p.rapidapi.com

# Gemini API配置
GEMINI_API_KEY=your-gemini-api-key-here

# R2存储配置（如果使用）
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=your-bucket-name
```

### 1.3 数据适配层（Adapter）

需要创建适配器函数，将RapidAPI返回的数据映射到数据库字段：

```typescript
// 示例：TikTok数据适配
interface TikTokRapidAPIResponse {
  // 需要根据实际API响应结构定义
  video_url?: string;
  title?: string;
  digg_count?: number;  // 点赞数
  play_count?: number;  // 播放量
  share_count?: number; // 转发量
  author?: string;
  // ... 其他字段
}

function adaptTikTokData(apiResponse: TikTokRapidAPIResponse) {
  return {
    title: apiResponse.title,
    likes: apiResponse.digg_count,
    views: apiResponse.play_count,
    shares: apiResponse.share_count,
    author: apiResponse.author,
    // ... 映射其他字段
  };
}
```

---

## 二、UI交互流程（最终确认）

### 2.1 初始状态

```
[URL输入框]
[按钮1: 🌐 自动识别] (disabled, 显示"Detecting...")
[按钮2: 🌍 翻译语言] (enabled, 下拉菜单，12种语言)
[按钮3: 📦 输出类型] (enabled, Subtitle/Video)
[提取按钮] (enabled, 如果URL有效)
```

### 2.2 第一阶段：提取字幕（3分钟）

**用户操作**:
1. 输入URL
2. （可选）选择目标语言（按钮2）
3. 选择输出类型（按钮3）
4. 点击"提取"按钮

**系统行为**:
- 按钮1显示"识别中..."
- 按钮2保持可选（用户可以先选择语言）
- **"开始翻译"按钮不存在或disabled**
- 进度条：0-100%
- 状态文本："Connecting to TikTok..." → "Analyzing Audio..." → "Extracting subtitles..."

**后端处理**:
1. 调用RapidAPI提取视频信息
2. 调用RapidAPI提取字幕
3. 保存元数据到数据库
4. 保存字幕文本到 `subtitle_raw` 字段
5. 更新状态：`extracting` → `extracted`

### 2.3 第一阶段完成

**UI变化**:
```
[按钮1: 🌐 English] (disabled, 显示检测到的语言)
[按钮2: 🌍 翻译语言] (enabled, 如果用户还没选择，可以现在选择)
[按钮3: 📦 Subtitle] (disabled, 显示当前选择)
[开始翻译按钮] (enabled, 新出现或从disabled变为enabled)
[下载原生SRT按钮] (enabled, 新出现)
```

**显示内容**:
- 视频元数据卡片（标题、点赞、播放量、转发等）
- 提示："Text extracted! Select a language to translate."

### 2.4 第二阶段：翻译（1分钟）

**用户操作**:
1. 确认或选择翻译语言（按钮2）
2. 点击"开始翻译"按钮

**系统行为**:
- "开始翻译"按钮变为disabled
- 进度条重新从0开始：0-100%
- 状态文本："Translating with Gemini..." → "Generating translated SRT..."

**后端处理**:
1. 读取 `subtitle_raw` 字段内容
2. 调用Gemini API翻译
3. 保存翻译结果到 `subtitle_translated` 字段
4. 更新状态：`extracted` → `translating` → `completed`

### 2.5 第二阶段完成

**UI变化**:
```
[下载原生SRT按钮] (enabled)
[下载翻译SRT按钮] (enabled, 新出现)
[导出CSV按钮] (enabled, 新出现，可选)
```

---

## 三、数据库Schema修改（最终版）

### 3.1 新增字段

基于您的确认，需要在 `mediaTasks` 表中添加以下字段：

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `subtitle_raw` | `TEXT` | 存储原始母语`.srt`内容 | `"1\n00:00:00,000 --> 00:00:05,000\nHello\n\n2\n..."` |
| `subtitle_translated` | `TEXT` | 存储Gemini翻译后的`.srt`内容 | `"1\n00:00:00,000 --> 00:00:05,000\n你好\n\n2\n..."` |
| `video_url_internal` | `VARCHAR(500)` | 存储转存到R2的内部访问地址 | `"https://r2.example.com/videos/abc123.mp4"` |
| `expires_at` | `TIMESTAMP` | 记录24小时过期的具体时间点 | `2024-01-16 10:30:00` |
| `target_language` | `VARCHAR(10)` | 用户选择的目标语言代码 | `"zh-CN"`, `"en"` |

### 3.2 Schema代码

```typescript
export const mediaTasks = pgTable(
  'media_tasks',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(), // 'youtube' | 'tiktok'
    videoUrl: text('video_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    title: text('title'),
    author: text('author'),
    duration: integer('duration'),
    likes: integer('likes'),
    views: integer('views'),
    shares: integer('shares'),
    publishedAt: timestamp('published_at'),
    sourceLang: text('source_lang'),
    targetLang: text('target_lang'),
    
    // 状态字段
    status: text('status').notNull().default('pending'), 
    // pending -> extracting -> extracted -> translating -> completed
    progress: integer('progress').notNull().default(0),
    
    // SRT文件URL（用于下载）
    srtUrl: text('srt_url'),
    translatedSrtUrl: text('translated_srt_url'),
    
    // 新增：字幕文本内容
    subtitleRaw: text('subtitle_raw'), // 原始母语字幕文本
    subtitleTranslated: text('subtitle_translated'), // 翻译后字幕文本
    
    // 视频相关
    resultVideoUrl: text('result_video_url'),
    videoUrlInternal: text('video_url_internal'), // R2内部地址
    expiresAt: timestamp('expires_at'), // 24小时过期时间
    
    // 新增：目标语言（用户选择的翻译语言）
    targetLanguage: text('target_language'), // 如 'zh-CN', 'en'
    
    // 错误处理
    errorMessage: text('error_message'),
    
    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_media_task_user_status').on(table.userId, table.status),
    index('idx_media_task_platform_status').on(table.platform, table.status),
    index('idx_media_task_expires').on(table.expiresAt), // 用于查询过期视频
  ]
);
```

### 3.3 SQL迁移脚本

```sql
-- 添加字幕文本字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS subtitle_raw TEXT,
ADD COLUMN IF NOT EXISTS subtitle_translated TEXT;

-- 添加视频存储字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS video_url_internal VARCHAR(500),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 添加目标语言字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS target_language VARCHAR(10);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_media_task_expires 
ON media_tasks(expires_at) 
WHERE expires_at IS NOT NULL;
```

---

## 四、视频暂存与过期处理

### 4.1 存储流程

1. **下载视频**:
   - RapidAPI返回视频URL
   - 后端下载视频到临时目录

2. **上传到R2**:
   - 上传视频到R2存储桶
   - 获得storage_key（如：`videos/{taskId}.mp4`）

3. **生成访问URL**:
   - 生成预签名URL（24小时有效）
   - 或使用R2的公共域名 + storage_key

4. **保存到数据库**:
   ```typescript
   await updateMediaTaskById(taskId, {
     videoUrlInternal: r2PublicUrl, // 或预签名URL
     expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后
   });
   ```

### 4.2 过期检查逻辑

**前端下载时**:
```typescript
// 检查视频是否过期
const task = await getMediaTask(taskId);
if (task.expiresAt && new Date() > task.expiresAt) {
  toast.error('链接已过期，请重新提取');
  return;
}
// 允许下载
```

**后端API**:
```typescript
// /api/media/download-video
export async function GET(request: Request) {
  const task = await findMediaTaskById(taskId);
  
  // 检查过期
  if (task.expiresAt && new Date() > task.expiresAt) {
    return respErr('Video link has expired. Please extract again.');
  }
  
  // 返回视频URL或重定向
  return Response.redirect(task.videoUrlInternal);
}
```

### 4.3 R2生命周期规则

在Cloudflare R2控制台配置：
- **规则名称**: Auto-delete videos after 1 day
- **条件**: 所有对象
- **操作**: Delete
- **时间**: 1 day after object creation

---

## 五、Gemini 3 Flash 翻译策略

### 5.1 翻译服务函数

```typescript
// src/shared/services/gemini-translator.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiTranslator {
  private client: GoogleGenerativeAI;
  private model: string = 'gemini-1.5-flash';

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async translateSubtitle(
    srtContent: string,
    targetLanguage: string
  ): Promise<string> {
    const model = this.client.getGenerativeModel({ model: this.model });
    
    const prompt = `You are a professional subtitle translator. 
Please translate the following SRT content into ${targetLanguage}. 
Keep the timestamps (00:00:00,000 --> 00:00:05,000) exactly as they are. 
Only translate the text content between timestamps. 
Return only the SRT format text, no explanations.

SRT content:
${srtContent}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  // 分片处理长字幕（如果需要）
  async translateSubtitleChunked(
    srtContent: string,
    targetLanguage: string,
    chunkSize: number = 50 // 每50行一个批次
  ): Promise<string> {
    const lines = srtContent.split('\n');
    const chunks: string[] = [];
    
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      const translatedChunk = await this.translateSubtitle(chunk, targetLanguage);
      chunks.push(translatedChunk);
    }
    
    return chunks.join('\n');
  }
}
```

### 5.2 Prompt优化

**基础Prompt**:
```
You are a professional subtitle translator. 
Please translate the following SRT content into [Target Language]. 
Keep the timestamps (00:00:00,000 --> 00:00:05,000) exactly as they are. 
Only translate the text content between timestamps. 
Return only the SRT format text, no explanations.
```

**优化建议**:
- 明确要求保持时间戳格式
- 要求只翻译文本内容
- 要求返回标准SRT格式
- 可以添加语言风格要求（正式/非正式）

---

## 六、CSV导出功能

### 6.1 导出数据结构

```csv
Video URL,Platform,Title,Author,Likes,Views,Shares,Duration,Published At,Source Language,Target Language,Subtitle Raw,Subtitle Translated,Created At
https://tiktok.com/...,tiktok,Video Title,Author Name,1000,50000,200,300,2024-01-01,en,zh-CN,"1\n00:00:00,000 --> 00:00:05,000\nHello\n\n2\n...","1\n00:00:00,000 --> 00:00:05,000\n你好\n\n2\n...",2024-01-15
```

### 6.2 实现位置

在任务结果展示区域（Result Card）添加导出按钮：

```tsx
{taskStatus?.status === 'completed' && (
  <div className="space-y-4">
    {/* 下载按钮 */}
    <div className="flex gap-2">
      <Button onClick={() => downloadSrt(taskStatus.srtUrl)}>
        Download Native SRT
      </Button>
      {taskStatus.translatedSrtUrl && (
        <Button onClick={() => downloadSrt(taskStatus.translatedSrtUrl)}>
          Download Translated SRT
        </Button>
      )}
    </div>
    
    {/* CSV导出按钮 */}
    <Button 
      variant="outline"
      onClick={() => exportToCSV(taskStatus)}
    >
      <Download className="mr-2 h-4 w-4" />
      Export CSV
    </Button>
  </div>
)}
```

### 6.3 CSV生成函数

```typescript
function exportToCSV(task: MediaTask) {
  const headers = [
    'Video URL', 'Platform', 'Title', 'Author', 'Likes', 'Views', 
    'Shares', 'Duration', 'Published At', 'Source Language', 
    'Target Language', 'Subtitle Raw', 'Subtitle Translated', 'Created At'
  ];

  const row = [
    task.videoUrl,
    task.platform,
    task.title || '',
    task.author || '',
    task.likes || 0,
    task.views || 0,
    task.shares || 0,
    task.duration || 0,
    task.publishedAt?.toISOString() || '',
    task.sourceLang || '',
    task.targetLanguage || '',
    task.subtitleRaw || '',
    task.subtitleTranslated || '',
    task.createdAt.toISOString()
  ];

  const csv = [
    headers.join(','),
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `media-task-${task.id}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

## 七、状态流转图（最终版）

```
pending (初始状态)
  ↓ [用户点击"提取"]
extracting (调用RapidAPI提取中，进度0-100%)
  ↓ [提取完成]
extracted (第一阶段完成)
  ↓ [用户选择语言，点击"开始翻译"]
translating (调用Gemini翻译中，进度0-100%)
  ↓ [翻译完成]
completed (所有处理完成)
  
失败路径：
extracting → failed
translating → failed
```

---

## 八、API调用流程

### 8.1 第一阶段：提取字幕

```typescript
// /api/media/submit
1. 创建mediaTasks记录（status: pending）
2. 更新状态（status: extracting）
3. 调用RapidAPI获取视频信息
   - YouTube: GET /transcript?video_id=xxx
   - TikTok: POST /index.php {url: "..."}
4. 解析API响应，提取元数据和字幕
5. 保存到数据库：
   - title, likes, views, shares, author等
   - subtitleRaw (SRT格式文本)
   - sourceLang (检测到的语言)
6. 更新状态（status: extracted）
7. 返回任务ID给前端
```

### 8.2 第二阶段：翻译

```typescript
// /api/media/translate
1. 读取任务记录（status: extracted）
2. 验证targetLanguage已选择
3. 更新状态（status: translating）
4. 调用Gemini API翻译subtitleRaw
5. 保存翻译结果：
   - subtitleTranslated (翻译后的SRT文本)
   - targetLanguage
6. 更新状态（status: completed）
7. 返回翻译结果
```

---

## 九、关键确认点

### ✅ 已确认

1. **RapidAPI端点**: 
   - YouTube: `youtube-transcriptor.p.rapidapi.com`
   - TikTok: `tiktok-transcriptor-api3.p.rapidapi.com`
   - TikTok下载: `tiktok-download-video1.p.rapidapi.com`（需要确认正确端点）

2. **UI流程**: 
   - 第一阶段完成后才激活"开始翻译"按钮 ✅
   - 用户可以先选择语言，但翻译按钮需等第一阶段完成 ✅

3. **数据库字段**: 
   - `subtitle_raw`, `subtitle_translated`, `video_url_internal`, `expires_at`, `target_language` ✅

4. **视频过期**: 
   - 24小时后过期，前端检查 `expires_at` ✅
   - R2自动删除（Lifecycle Rule）✅

5. **Gemini翻译**: 
   - 使用 `gemini-1.5-flash` ✅
   - 保持SRT时间戳格式 ✅

### ⚠️ 需要确认

1. **TikTok视频下载端点**: 
   - 提供的示例是 `photoSearch`，可能需要确认实际的视频下载端点
   - 是否需要先提取视频URL，再下载？

2. **RapidAPI响应格式**: 
   - 需要实际测试API响应，确认数据结构
   - 特别是元数据字段的命名（digg_count vs likes等）

3. **字幕格式**: 
   - RapidAPI返回的字幕格式是什么？（SRT？JSON？）
   - 是否需要转换格式？

---

## 十、实施优先级

### Phase 1: 核心功能（必须）
1. ✅ 数据库Schema修改
2. ✅ RapidAPI集成（YouTube/TikTok字幕提取）
3. ✅ 元数据提取和保存
4. ✅ 第一阶段流程实现

### Phase 2: 翻译功能（重要）
5. ✅ Gemini API集成
6. ✅ 两阶段翻译流程
7. ✅ UI交互优化（按钮状态管理）

### Phase 3: 存储和优化（优化）
8. ✅ R2视频存储
9. ✅ 视频过期检查
10. ✅ 进度条和Loading优化

### Phase 4: 数据导出（完善）
11. ✅ CSV导出功能

---

## 📌 总结

所有核心细节已确认，技术方案完整。等待您的最终确认后即可开始实施。

**关键点回顾**:
- ✅ RapidAPI作为核心视频处理服务
- ✅ Gemini 1.5 Flash用于翻译
- ✅ R2存储视频，24小时自动过期
- ✅ 两阶段流程：提取 → 翻译
- ✅ UI：第一阶段完成后激活翻译按钮
- ✅ 数据库：5个新字段

**准备开始编码！** 🚀


