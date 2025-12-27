# Vercel 环境变量配置指南

本文档提供三种方式配置 Vercel 环境变量，选择最适合您的方式。

---

## 🚀 方式一：自动化脚本（推荐）

### 选项 A: TypeScript 脚本

```bash
# 1. 安装依赖（如果还没有）
pnpm install

# 2. 运行脚本
npx tsx scripts/setup-vercel-env.ts
```

脚本会提示您输入：
- Vercel Access Token（获取地址：https://vercel.com/account/tokens）
- 项目名称或项目ID

### 选项 B: PowerShell 脚本（Windows）

```powershell
# 1. 运行脚本
.\scripts\setup-vercel-env.ps1
```

或者设置环境变量后运行：

```powershell
$env:VERCEL_TOKEN = "your-token"
$env:VERCEL_PROJECT_ID = "your-project"
.\scripts\setup-vercel-env.ps1
```

---

## 📝 方式二：手动配置（最简单）

### 步骤 1: 登录 Vercel Dashboard

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目 `subtitletk.app`

### 步骤 2: 进入环境变量设置

1. 点击 **Settings** → **Environment Variables**

### 步骤 3: 添加环境变量

按照 `scripts/setup-vercel-env-manual.md` 中的清单，逐个添加 9 个环境变量。

**快速参考**：查看 `VERCEL_ENV_QUICK_REFERENCE.md`

---

## 🔧 方式三：使用 Vercel CLI

### 安装 Vercel CLI

```bash
npm i -g vercel
```

### 登录并配置

```bash
# 1. 登录
vercel login

# 2. 链接项目
vercel link

# 3. 添加环境变量（示例）
vercel env add NEXT_PUBLIC_RAPIDAPI_KEY production preview development
# 输入值: 558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b

# 重复以上步骤添加所有 9 个变量
```

---

## 📋 需要配置的 9 个环境变量

| # | Key | Value |
|---|-----|-------|
| 1 | `NEXT_PUBLIC_RAPIDAPI_KEY` | `558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b` |
| 2 | `RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST` | `tiktok-transcriptor-api3.p.rapidapi.com` |
| 3 | `RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST` | `tiktok-transcript.p.rapidapi.com` |
| 4 | `RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST` | `snap-video3.p.rapidapi.com` |
| 5 | `RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST` | `tiktok-video-no-watermark2.p.rapidapi.com` |
| 6 | `RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST` | `youtube-video-summarizer-gpt-ai.p.rapidapi.com` |
| 7 | `RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST` | `youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com` |
| 8 | `RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST` | `youtube-video-and-shorts-downloader1.p.rapidapi.com` |
| 9 | `RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST` | `youtube-video-downloader.p.rapidapi.com` |

**重要**：每个变量都要勾选 **Production**、**Preview** 和 **Development** 三个环境。

---

## ✅ 配置完成后的操作

1. **验证配置**：在 Vercel Dashboard 中检查所有变量是否已添加
2. **重新部署**：Vercel 会自动检测环境变量变更，或手动触发重新部署
3. **测试功能**：测试 TikTok 和 YouTube 的主备切换功能

---

## 🆘 常见问题

### Q: 脚本执行失败？
A: 检查：
- Vercel Token 是否正确
- 项目ID是否正确
- 网络连接是否正常

### Q: 部分变量配置失败？
A: 可以：
- 查看错误信息，手动在 Dashboard 中配置失败的变量
- 或使用方式二（手动配置）完成剩余配置

### Q: 如何获取 Vercel Token？
A: 
1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 输入名称（如 "Subtitle TK Config"）
4. 选择过期时间
5. 复制生成的 Token

### Q: 如何获取项目ID？
A:
1. 在 Vercel Dashboard 中选择项目
2. 进入 Settings → General
3. 在 "Project ID" 部分可以看到项目ID
4. 或者直接使用项目名称（slug）

---

## 📚 相关文档

- `VERCEL_ENV_VARIABLES_PLAN.md` - 完整配置方案
- `VERCEL_ENV_QUICK_REFERENCE.md` - 快速参考表
- `scripts/setup-vercel-env-manual.md` - 手动配置详细步骤

