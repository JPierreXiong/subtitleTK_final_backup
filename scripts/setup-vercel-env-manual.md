# Vercel 环境变量手动配置指南

如果自动脚本无法使用，可以按照以下步骤手动配置。

---

## 🚀 快速配置步骤

### 步骤 1: 登录 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目 `subtitletk.app`（或您的项目名称）

### 步骤 2: 进入环境变量设置

1. 点击顶部导航栏的 **Settings**
2. 在左侧菜单选择 **Environment Variables**

### 步骤 3: 批量添加环境变量

按照以下顺序添加，每个变量都要勾选 **Production**、**Preview** 和 **Development**：

---

## 📋 环境变量清单（复制粘贴）

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

## ✅ 配置完成检查

配置完成后，您应该看到 **9 个环境变量**：

1. ✅ `NEXT_PUBLIC_RAPIDAPI_KEY`
2. ✅ `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST`
3. ✅ `RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST`
4. ✅ `RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST`
5. ✅ `RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST`
6. ✅ `RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST`
7. ✅ `RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST`
8. ✅ `RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST`
9. ✅ `RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST`

---

## 🔄 应用配置

配置完成后：

1. **重新部署应用**：Vercel 会自动检测环境变量变更
2. **或手动触发部署**：在 Deployments 页面点击 "Redeploy"

---

## 📚 相关文档

- `VERCEL_ENV_VARIABLES_PLAN.md` - 完整配置方案
- `VERCEL_ENV_QUICK_REFERENCE.md` - 快速参考表

