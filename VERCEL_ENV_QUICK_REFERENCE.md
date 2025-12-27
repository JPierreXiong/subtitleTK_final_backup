# Vercel 环境变量快速配置参考

## 🚀 快速配置清单

在 Vercel Dashboard → Settings → Environment Variables 中添加以下变量：

---

## 📋 必需配置（9 个变量）

### 1. 通用 API Key
```
Key: NEXT_PUBLIC_RAPIDAPI_KEY
Value: 558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b
Environment: ✅ Production ✅ Preview ✅ Development
```

### 2. TikTok 文案提取
```
Key: RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST
Value: tiktok-transcriptor-api3.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development

Key: RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST
Value: tiktok-transcript.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development
```

### 3. TikTok 视频下载
```
Key: RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST
Value: snap-video3.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development

Key: RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST
Value: tiktok-video-no-watermark2.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development
```

### 4. YouTube 文案提取
```
Key: RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST
Value: youtube-video-summarizer-gpt-ai.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development

Key: RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST
Value: youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development
```

### 5. YouTube 视频下载
```
Key: RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST
Value: youtube-video-and-shorts-downloader1.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development

Key: RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST
Value: youtube-video-downloader.p.rapidapi.com
Environment: ✅ Production ✅ Preview ✅ Development
```

---

## 📊 配置表格（复制粘贴用）

| Key | Value | Environment |
|-----|-------|-------------|
| `NEXT_PUBLIC_RAPIDAPI_KEY` | `558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b` | Production, Preview, Development |
| `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST` | `tiktok-transcriptor-api3.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST` | `tiktok-transcript.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST` | `snap-video3.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST` | `tiktok-video-no-watermark2.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST` | `youtube-video-summarizer-gpt-ai.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST` | `youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST` | `youtube-video-and-shorts-downloader1.p.rapidapi.com` | Production, Preview, Development |
| `RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST` | `youtube-video-downloader.p.rapidapi.com` | Production, Preview, Development |

---

## 🎯 命名规则说明

```
RAPIDAPI_{平台}_{功能}_{优先级}_HOST
```

- **平台**: `TIKTOK` | `YOUTUBE`
- **功能**: `TRANSCRIPT` | `VIDEO`
- **优先级**: `PRIMARY` (主/免费) | `BACKUP` (备/付费)

---

## ✅ 配置完成后

1. 重新部署应用（Vercel 会自动检测环境变量变更）
2. 验证配置是否生效（查看日志）
3. 测试主备切换功能

---

## 📚 详细文档

查看 `VERCEL_ENV_VARIABLES_PLAN.md` 获取完整说明。

