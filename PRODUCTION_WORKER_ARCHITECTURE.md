# 生产级 Worker 架构方案

## 📋 执行摘要

本文档提供一套**完整的、可落地的生产级方案**，实现：
- ✅ RapidAPI 获取视频信息
- ✅ 完整视频下载 → 音频提取 → ASR 转字幕 → 文案提炼
- ✅ 兼容现有 `media_tasks + watchdog + credits` 结构
- ✅ 可 Worker / Queue 化
- ✅ 不改变 ShipAny 结构

---

## 🏗️ 一、整体架构设计

### 1.1 架构图

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ POST /api/media/submit
       ▼
┌─────────────────────────────────────┐
│   Vercel API (轻逻辑)                │
│   - 验证用户和积分                    │
│   - 创建 media_tasks (pending)      │
│   - 发送到 Queue                     │
│   - 立即返回 taskId                  │
└──────┬──────────────────────────────┘
       │
       │ enqueue(taskId, url, outputType)
       ▼
┌─────────────────────────────────────┐
│         Queue (Upstash QStash)      │
│   - 持久化任务                        │
│   - 重试机制                          │
│   - 延迟执行                          │
└──────┬──────────────────────────────┘
       │
       │ HTTP POST to Worker
       ▼
┌─────────────────────────────────────┐
│   Worker (Railway / Fly.io / ECS)   │
│   - 常驻进程                          │
│   - 无超时限制                        │
│   - 完整处理流程                      │
└──────┬──────────────────────────────┘
       │
       ├─ Step 1: RapidAPI 获取视频信息
       ├─ Step 2: 下载视频文件
       ├─ Step 3: 提取音频
       ├─ Step 4: ASR 转字幕
       ├─ Step 5: 文案提炼
       └─ 更新 media_tasks 状态
```

### 1.2 关键设计原则

1. **API 层只负责"登记"**：快速响应，不阻塞
2. **Worker 层负责"执行"**：完整流程，无超时限制
3. **Queue 层负责"调度"**：持久化、重试、延迟
4. **数据库层负责"状态"**：所有状态变更都写回 `media_tasks`

---

## 🔧 二、Queue 集成方案（Upstash QStash）

### 2.1 为什么选择 QStash？

| 特性 | QStash | Supabase Queue | 自建 Queue |
|------|--------|---------------|------------|
| 零配置 | ✅ | ⚠️ 需配置 | ❌ |
| HTTP-based | ✅ | ❌ | ❌ |
| 重试机制 | ✅ 内置 | ⚠️ 需实现 | ❌ |
| 持久化 | ✅ | ✅ | ⚠️ |
| 成本 | 💰 低 | 💰 免费 | 💰 中等 |

**QStash 优势：**
- HTTP-based，无需维护连接
- 内置重试和延迟
- 与 Vercel 完美集成
- 免费额度充足

### 2.2 安装和配置

```bash
npm install @upstash/qstash
```

```typescript
// src/shared/services/queue/qstash.ts
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function enqueueMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  const workerUrl = process.env.WORKER_URL || 'https://your-worker.railway.app';
  
  await qstash.publishJSON({
    url: `${workerUrl}/api/worker/process`,
    body: {
      taskId,
      url,
      outputType,
      userId,
    },
    retries: 3, // 最多重试 3 次
    delay: 0, // 立即执行
  });
}
```

---

## 🚀 三、Worker 架构设计

### 3.1 Worker 环境要求

**必需组件：**
- Node.js 18+
- ffmpeg（音频提取）
- faster-whisper 或云 ASR API
- 足够的磁盘空间（临时文件）

**推荐平台：**
- Railway（推荐）：简单、便宜、支持 Docker
- Fly.io：全球部署、自动扩展
- AWS ECS / GCP Cloud Run：企业级

### 3.2 Worker Dockerfile

```dockerfile
# Dockerfile
FROM node:18-slim

# 安装 ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 安装 faster-whisper（可选，如果使用本地 ASR）
RUN pip3 install faster-whisper

WORKDIR /app

# 复制 package.json
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "worker/index.js"]
```

### 3.3 Worker 主入口

```typescript
// worker/index.ts
import express from 'express';
import { processMediaTask } from './process-task';

const app = express();
app.use(express.json());

// Worker 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 处理任务（从 QStash 接收）
app.post('/api/worker/process', async (req, res) => {
  try {
    const { taskId, url, outputType, userId } = req.body;
    
    // 立即返回 200，避免 QStash 重试
    res.status(200).json({ received: true, taskId });
    
    // 异步处理任务
    processMediaTask(taskId, url, outputType, userId)
      .catch((error) => {
        console.error('[Worker Task Failed]', {
          taskId,
          error: error.message,
          stack: error.stack,
        });
      });
  } catch (error: any) {
    console.error('[Worker Request Error]', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});
```

---

## 📦 四、完整处理流程实现

### 4.1 核心处理函数

```typescript
// worker/process-task.ts
import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { eq } from 'drizzle-orm';
import { fetchMediaFromRapidAPI } from '@/shared/services/media/rapidapi';
import { downloadVideo } from './download-video';
import { extractAudio } from './extract-audio';
import { transcribeAudio } from './transcribe';
import { extractContent } from './extract-content';
import { uploadToStorage } from './upload-storage';

export async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  try {
    // Step 0: 更新状态为 processing
    await updateTaskStatus(taskId, 'processing', 10);
    
    // Step 1: RapidAPI 获取视频信息
    await updateTaskStatus(taskId, 'processing', 20);
    const mediaInfo = await fetchMediaFromRapidAPI(url, outputType);
    
    // 保存元数据
    await updateTaskMetadata(taskId, {
      platform: mediaInfo.platform,
      title: mediaInfo.title,
      author: mediaInfo.author,
      likes: mediaInfo.likes,
      views: mediaInfo.views,
      shares: mediaInfo.shares,
      duration: mediaInfo.duration,
      thumbnailUrl: mediaInfo.thumbnailUrl,
      sourceLang: mediaInfo.sourceLang || 'auto',
    });
    
    // Step 2: 下载视频文件
    await updateTaskStatus(taskId, 'processing', 30);
    const videoPath = await downloadVideo(mediaInfo.videoUrl, taskId);
    
    // Step 3: 提取音频
    await updateTaskStatus(taskId, 'processing', 40);
    const audioPath = await extractAudio(videoPath, taskId);
    
    // Step 4: ASR 转字幕
    await updateTaskStatus(taskId, 'processing', 60);
    const subtitles = await transcribeAudio(audioPath);
    
    // 保存字幕（SRT 格式）
    const srtContent = formatSubtitlesToSRT(subtitles);
    await updateTaskStatus(taskId, 'processing', 70, {
      subtitleRaw: srtContent,
    });
    
    // Step 5: 文案提炼
    await updateTaskStatus(taskId, 'processing', 80);
    const content = await extractContent(subtitles);
    
    // Step 6: 上传视频到存储（如果需要）
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;
    
    if (outputType === 'video') {
      await updateTaskStatus(taskId, 'processing', 85);
      videoUrlInternal = await uploadToStorage(videoPath, taskId);
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 小时
    }
    
    // Step 7: 清理临时文件
    await cleanupTempFiles([videoPath, audioPath]);
    
    // Step 8: 完成
    await updateTaskStatus(taskId, 'extracted', 100, {
      videoUrlInternal,
      expiresAt,
      // content 可以存储在 subtitleTranslated 或新字段
    });
    
  } catch (error: any) {
    console.error('[Process Task Failed]', {
      taskId,
      error: error.message,
      stack: error.stack,
    });
    
    // 更新状态为 failed（会触发退款）
    await updateTaskStatus(taskId, 'failed', 0, {
      errorMessage: error.message,
    });
    
    // 清理临时文件
    await cleanupTempFiles([videoPath, audioPath].filter(Boolean));
  }
}
```

---

## 📥 五、视频下载实现（可靠下载）

### 5.1 下载函数

```typescript
// worker/download-video.ts
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const TEMP_DIR = process.env.TEMP_DIR || '/tmp';

export async function downloadVideo(
  videoUrl: string,
  taskId: string
): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${taskId}-video.mp4`);
  const controller = new AbortController();
  
  // 超时：60 秒
  const timeout = setTimeout(() => controller.abort(), 60000);
  
  try {
    // 下载视频
    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    if (!response.body) {
      throw new Error('No response body');
    }
    
    // 流式写入文件
    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(response.body as any, fileStream);
    
    clearTimeout(timeout);
    
    // 验证文件大小
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    return outputPath;
  } catch (error: any) {
    clearTimeout(timeout);
    
    // 清理失败的文件
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    
    throw error;
  }
}
```

### 5.2 重试机制

```typescript
async function downloadVideoWithRetry(
  videoUrl: string,
  taskId: string,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await downloadVideo(videoUrl, taskId);
    } catch (error: any) {
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 指数退避
      await sleep(1000 * Math.pow(2, i));
      console.log(`[Retry ${i + 1}/${maxRetries}] Retrying download...`);
    }
  }
  
  throw new Error('Download failed after all retries');
}
```

---

## 🎵 六、音频提取实现

### 6.1 使用 ffmpeg 提取音频

```typescript
// worker/extract-audio.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const TEMP_DIR = process.env.TEMP_DIR || '/tmp';

export async function extractAudio(
  videoPath: string,
  taskId: string
): Promise<string> {
  const audioPath = path.join(TEMP_DIR, `${taskId}-audio.wav`);
  
  // ffmpeg 命令：提取音频，单声道，16kHz
  const command = `ffmpeg -i "${videoPath}" -vn -ac 1 -ar 16000 -y "${audioPath}"`;
  
  try {
    await execAsync(command);
    
    // 验证文件
    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio extraction failed: file not created');
    }
    
    const stats = fs.statSync(audioPath);
    if (stats.size === 0) {
      throw new Error('Audio extraction failed: file is empty');
    }
    
    return audioPath;
  } catch (error: any) {
    // 清理失败的文件
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
    throw error;
  }
}
```

---

## 🗣️ 七、ASR 转字幕实现

### 7.1 方案选择

| 方案 | 成本 | 速度 | 准确度 | 推荐度 |
|------|------|------|--------|--------|
| faster-whisper（本地） | 💰 低 | ⚡ 快 | ⭐⭐⭐⭐ | ✅ 推荐 |
| 云 ASR API | 💰 中 | ⚡ 中 | ⭐⭐⭐⭐⭐ | ⚠️ 备用 |
| RapidAPI 字幕 | 💰 低 | ⚡ 快 | ⭐⭐⭐ | ✅ 优先 |

### 7.2 实现（优先使用 RapidAPI，降级到 faster-whisper）

```typescript
// worker/transcribe.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export async function transcribeAudio(
  audioPath: string,
  taskId: string
): Promise<SubtitleSegment[]> {
  // 方案 1: 尝试使用 RapidAPI 字幕（如果可用）
  // 注意：这需要在 Step 1 中已经获取
  
  // 方案 2: 使用 faster-whisper（本地）
  try {
    return await transcribeWithWhisper(audioPath);
  } catch (error) {
    console.error('[Whisper Failed]', error);
    throw new Error('ASR transcription failed');
  }
}

async function transcribeWithWhisper(
  audioPath: string
): Promise<SubtitleSegment[]> {
  // faster-whisper 命令
  const command = `python3 -m faster_whisper.transcribe "${audioPath}" --model base --output_format json`;
  
  const { stdout } = await execAsync(command);
  const result = JSON.parse(stdout);
  
  // 转换为统一格式
  return result.segments.map((seg: any) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
  }));
}
```

### 7.3 SRT 格式化

```typescript
function formatSubtitlesToSRT(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, index) => {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      return `${index + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}
```

---

## 📝 八、文案提炼实现

### 8.1 分块提炼策略

```typescript
// worker/extract-content.ts
import { translateSubtitleWithGemini } from '@/shared/services/media/gemini-translator';

interface ContentExtract {
  summary: string;
  outline: string[];
  keyPoints: string[];
  duration: number;
  language: string;
}

export async function extractContent(
  segments: SubtitleSegment[]
): Promise<ContentExtract> {
  // Step 1: 按时间切块（60-90 秒）
  const chunks = splitByTime(segments, 60);
  
  // Step 2: 每块提炼
  const chunkResults = await Promise.all(
    chunks.map((chunk, index) => extractChunkContent(chunk, index))
  );
  
  // Step 3: 合并为完整文案
  return mergeChunkResults(chunkResults, segments);
}

function splitByTime(
  segments: SubtitleSegment[],
  chunkDuration: number
): SubtitleSegment[][] {
  const chunks: SubtitleSegment[][] = [];
  let currentChunk: SubtitleSegment[] = [];
  let currentEnd = 0;
  
  for (const seg of segments) {
    if (currentChunk.length === 0 || seg.start - currentEnd >= chunkDuration) {
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
  
  return chunks;
}

async function extractChunkContent(
  chunk: SubtitleSegment[],
  index: number
): Promise<{
  mainPoints: string[];
  examples: string[];
  actions: string[];
}> {
  const text = chunk.map((s) => s.text).join(' ');
  
  // 使用 Gemini 提炼（可以复用现有的翻译服务）
  const prompt = `Extract key information from this video segment:

${text}

Return JSON:
{
  "main_points": ["..."],
  "examples": ["..."],
  "actions": ["..."]
}`;
  
  // 调用 Gemini API
  // ... 实现细节
  
  return {
    mainPoints: [],
    examples: [],
    actions: [],
  };
}
```

---

## 🔄 九、与现有系统集成

### 9.1 修改 API 路由（最小改动）

```typescript
// src/app/api/media/submit/route.ts
// 在现有代码基础上，只修改异步处理部分

// 原有代码...
await createMediaTask(newTask, requiredCredits);

// 修改：使用 Queue 而不是 setTimeout
if (process.env.USE_WORKER === 'true') {
  // 使用 Worker
  const { enqueueMediaTask } = await import('@/shared/services/queue/qstash');
  await enqueueMediaTask(taskId, url, outputType || 'subtitle', currentUser.id);
} else {
  // 原有逻辑（兼容）
  setTimeout(() => {
    processMediaTask(...).catch(...);
  }, 100);
}

return respData({ taskId, message: 'Task submitted successfully' });
```

### 9.2 状态更新函数（复用现有）

```typescript
// worker/update-task.ts
import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { eq } from 'drizzle-orm';
import { updateMediaTaskById } from '@/shared/models/media_task';

export async function updateTaskStatus(
  taskId: string,
  status: string,
  progress: number,
  additionalData?: any
) {
  await updateMediaTaskById(taskId, {
    status: status as any,
    progress,
    ...additionalData,
  });
}
```

---

## 🛡️ 十、错误处理和降级策略

### 10.1 降级策略表

| 阶段 | 失败原因 | 降级方案 | 最终状态 |
|------|---------|---------|---------|
| RapidAPI | API 超时 | 重试 3 次 | failed + 退款 |
| 视频下载 | 网络失败 | 降清晰度重试 | failed + 退款 |
| 音频提取 | ffmpeg 失败 | 跳过音频，使用 RapidAPI 字幕 | extracted（无字幕） |
| ASR | 超时 | 只处理前 5 分钟 | extracted（部分字幕） |
| 文案提炼 | LLM 超时 | 只输出要点 | extracted（简化文案） |

### 10.2 实现示例

```typescript
async function processMediaTaskWithFallback(...) {
  try {
    // 正常流程
    const mediaInfo = await fetchMediaFromRapidAPI(url, outputType);
    const videoPath = await downloadVideoWithRetry(mediaInfo.videoUrl, taskId);
    const audioPath = await extractAudio(videoPath, taskId);
    const subtitles = await transcribeAudio(audioPath);
    const content = await extractContent(subtitles);
    
    // 成功
    await updateTaskStatus(taskId, 'extracted', 100, {
      subtitleRaw: formatSubtitlesToSRT(subtitles),
      // content...
    });
  } catch (error: any) {
    // 降级：尝试使用 RapidAPI 字幕
    if (error.message.includes('download') || error.message.includes('audio')) {
      try {
        const mediaInfo = await fetchMediaFromRapidAPI(url, 'subtitle');
        if (mediaInfo.subtitleRaw) {
          await updateTaskStatus(taskId, 'extracted', 100, {
            subtitleRaw: mediaInfo.subtitleRaw,
            errorMessage: 'Video download failed, using API subtitle',
          });
          return;
        }
      } catch (fallbackError) {
        // 降级也失败
      }
    }
    
    // 最终失败
    await updateTaskStatus(taskId, 'failed', 0, {
      errorMessage: error.message,
    });
  }
}
```

---

## 📊 十一、成本估算

### 11.1 单次任务成本（3 分钟视频）

| 项目 | 成本 | 说明 |
|------|------|------|
| RapidAPI | $0.01 | 获取视频信息 |
| 视频下载 | $0.00 | 带宽（Worker 流量） |
| 音频提取 | $0.00 | ffmpeg（本地） |
| ASR | $0.00 | faster-whisper（本地）或 $0.02（云 API） |
| 文案提炼 | $0.01 | Gemini API |
| Worker 运行 | $0.00 | Railway Free 或 $0.01（按需） |
| **总计** | **$0.02-0.04** |  |

### 11.2 定价建议

- 免费用户：1 次/天
- 付费用户：$0.10/次（2.5-5 倍成本）

---

## 🚀 十二、实施步骤

### Phase 1: 基础搭建（1-2 天）

1. ✅ 设置 Upstash QStash
2. ✅ 创建 Worker 项目（Railway）
3. ✅ 实现基础 Worker 入口
4. ✅ 修改 API 路由集成 Queue

### Phase 2: 核心功能（3-5 天）

1. ✅ 实现视频下载（带重试）
2. ✅ 实现音频提取（ffmpeg）
3. ✅ 实现 ASR（faster-whisper）
4. ✅ 实现文案提炼（Gemini）

### Phase 3: 优化和测试（2-3 天）

1. ✅ 错误处理和降级
2. ✅ 性能优化
3. ✅ 端到端测试
4. ✅ 监控和日志

---

## 📝 十三、关键文件清单

### 需要创建的文件

```
worker/
  ├── index.ts              # Worker 主入口
  ├── process-task.ts       # 核心处理逻辑
  ├── download-video.ts     # 视频下载
  ├── extract-audio.ts      # 音频提取
  ├── transcribe.ts         # ASR 转字幕
  ├── extract-content.ts    # 文案提炼
  ├── upload-storage.ts     # 上传到存储
  ├── update-task.ts        # 状态更新
  └── cleanup.ts            # 清理临时文件

src/shared/services/queue/
  └── qstash.ts            # Queue 集成

Dockerfile                  # Worker Docker 镜像
```

### 需要修改的文件

```
src/app/api/media/submit/route.ts  # 集成 Queue
```

---

## ✅ 十四、总结

### 核心优势

1. ✅ **不改变 ShipAny 结构**：完全兼容现有数据库和业务逻辑
2. ✅ **生产级可靠**：完整的错误处理和降级策略
3. ✅ **可扩展**：Worker 可以独立扩展，不受 Vercel 限制
4. ✅ **成本可控**：本地 ASR，成本低
5. ✅ **用户体验好**：要么成功，要么明确失败 + 退款

### 关键成功因素

1. **RapidAPI 只是入口**：真正处理在 Worker 中
2. **可靠下载**：流式 + 重试 + 超时
3. **降级策略**：每个环节都有备选方案
4. **状态管理**：所有状态变更都写回数据库

---

**下一步：** 我可以开始实现具体的代码文件。

