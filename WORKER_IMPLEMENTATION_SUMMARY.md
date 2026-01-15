# Worker 架构实施总结

## ✅ 已完成的工作

### Phase 1: 基础搭建 ✅

1. **Queue 集成服务（QStash）** ✅
   - 文件：`src/shared/services/queue/qstash.ts`
   - 功能：任务入队、重试机制、环境检测

2. **Worker 主入口** ✅
   - 文件：`worker/index.ts`
   - 功能：Express 服务器、健康检查、任务接收端点

3. **API 路由集成** ✅
   - 文件：`src/app/api/media/submit/route.ts`（已修改）
   - 功能：自动检测 Worker 模式，降级到 setTimeout

### Phase 2: 核心功能 ✅

4. **视频下载功能** ✅
   - 文件：`worker/download-video.ts`
   - 功能：流式下载、重试机制（最多3次）、超时保护（60秒）

5. **音频提取功能** ✅
   - 文件：`worker/extract-audio.ts`
   - 功能：ffmpeg 音频提取、单声道16kHz、错误处理

6. **ASR 转字幕功能** ✅
   - 文件：`worker/transcribe.ts`
   - 功能：SRT 格式化、RapidAPI 字幕解析、云 ASR 接口预留
   - **注意**：不使用 faster-whisper，优先使用 RapidAPI 字幕

7. **文案提炼功能** ✅
   - 文件：`worker/extract-content.ts`
   - 功能：摘要提取、关键点提取、大纲生成、Gemini 集成

8. **Dockerfile 和部署配置** ✅
   - 文件：`worker/Dockerfile`、`worker/package.json`、`worker/README.md`
   - 功能：完整的 Docker 镜像、部署文档

## 📁 文件结构

```
worker/
  ├── index.ts              # Worker 主入口
  ├── process-task.ts       # 核心处理逻辑
  ├── download-video.ts     # 视频下载（带重试）
  ├── extract-audio.ts      # 音频提取（ffmpeg）
  ├── transcribe.ts         # ASR 转字幕
  ├── extract-content.ts    # 文案提炼
  ├── cleanup.ts            # 临时文件清理
  ├── Dockerfile            # Docker 镜像
  ├── package.json          # Worker 依赖
  ├── .dockerignore         # Docker 忽略文件
  └── README.md             # 部署文档

src/shared/services/queue/
  └── qstash.ts            # QStash 集成

src/app/api/media/
  └── submit/route.ts      # 已修改，支持 Worker 模式
```

## 🔧 环境变量配置

### Vercel API（主应用）

```bash
# QStash Token（从 Upstash 获取）
QSTASH_TOKEN=your_qstash_token

# Worker URL（Worker 部署后的 URL）
WORKER_URL=https://your-worker.railway.app

# 启用 Worker 模式
USE_WORKER=true
```

### Worker 环境

```bash
# 数据库连接（与主应用相同）
DATABASE_URL=postgresql://...

# 临时文件目录
TEMP_DIR=/tmp

# 端口
PORT=3000

# RapidAPI 配置（与主应用相同）
NEXT_PUBLIC_RAPIDAPI_KEY=...
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=...
# ... 其他 RapidAPI 配置

# Gemini API（用于文案提炼）
GEMINI_API_KEY=...
```

## 🚀 部署步骤

### 1. 设置 Upstash QStash

1. 访问 https://upstash.com/
2. 创建 QStash 项目
3. 获取 `QSTASH_TOKEN`
4. 添加到 Vercel 环境变量

### 2. 部署 Worker

#### 选项 A: Railway（推荐）

1. 访问 https://railway.app/
2. 创建新项目
3. 连接 GitHub 仓库
4. 选择 "Deploy from Dockerfile"
5. 设置 Dockerfile 路径：`worker/Dockerfile`
6. 添加环境变量
7. 获取部署 URL，设置为 `WORKER_URL`

#### 选项 B: Fly.io

```bash
cd worker
fly launch --dockerfile Dockerfile
fly secrets set DATABASE_URL=...
fly secrets set WORKER_URL=...
```

### 3. 配置 Vercel

1. 在 Vercel 项目设置中添加环境变量：
   - `QSTASH_TOKEN`
   - `WORKER_URL`
   - `USE_WORKER=true`

2. 重新部署应用

## 🧪 测试

### 1. 测试 Worker 健康检查

```bash
curl https://your-worker.railway.app/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "2024-12-19T...",
  "service": "media-worker"
}
```

### 2. 测试任务提交

1. 在前端提交一个视频 URL
2. 检查 Vercel 日志，应该看到 `[Queue] Task xxx enqueued to Worker`
3. 检查 Worker 日志，应该看到任务处理过程
4. 检查数据库，任务状态应该从 `pending` → `processing` → `extracted`

## 📊 处理流程

```
用户提交 URL
  ↓
Vercel API 创建任务（pending）
  ↓
发送到 QStash Queue
  ↓
Worker 接收任务
  ↓
Step 1: RapidAPI 获取视频信息
  ↓
Step 2: 下载视频（如果需要）
  ↓
Step 3: 提取音频（如果需要 ASR）
  ↓
Step 4: 处理字幕（优先 RapidAPI）
  ↓
Step 5: 文案提炼（可选）
  ↓
更新数据库（extracted）
  ↓
清理临时文件
```

## ⚠️ 注意事项

1. **不使用 faster-whisper**：优先使用 RapidAPI 字幕，如果不可用则标记失败
2. **临时文件清理**：所有临时文件在处理完成后自动清理
3. **错误处理**：任何步骤失败都会标记任务为 `failed` 并触发退款
4. **降级策略**：如果 Worker 不可用，自动降级到原有的 `setTimeout` 模式

## 🔄 下一步优化

1. **视频存储上传**：实现 `uploadToStorage` 函数，将下载的视频上传到 R2/Vercel Blob
2. **云 ASR 集成**：如果需要，可以集成 Google Cloud Speech-to-Text 或其他云 ASR 服务
3. **监控和日志**：添加更详细的监控和日志记录
4. **性能优化**：优化大文件下载和处理的性能

## 📝 关键代码位置

- **Queue 集成**：`src/shared/services/queue/qstash.ts`
- **Worker 入口**：`worker/index.ts`
- **任务处理**：`worker/process-task.ts`
- **视频下载**：`worker/download-video.ts`
- **音频提取**：`worker/extract-audio.ts`
- **字幕处理**：`worker/transcribe.ts`
- **文案提炼**：`worker/extract-content.ts`

---

**实施完成时间**：2024-12-19
**状态**：✅ 所有核心功能已实现，可以开始部署和测试



