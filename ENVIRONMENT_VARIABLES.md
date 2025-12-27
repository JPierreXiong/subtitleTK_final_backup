# 环境变量清单

本文档列出了程序中**实际使用**的所有环境变量，按功能分类。

---

## 📋 目录

- [基础应用配置](#基础应用配置)
- [数据库配置](#数据库配置)
- [认证配置](#认证配置)
- [支付配置](#支付配置)
- [RapidAPI 配置](#rapidapi-配置)
- [AI 服务配置](#ai-服务配置)
- [存储配置](#存储配置)
- [邮件配置](#邮件配置)
- [系统环境变量](#系统环境变量)

---

## 基础应用配置

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3000` | 应用 URL | `src/config/index.ts` |
| `NEXT_PUBLIC_APP_NAME` | ❌ | `Subtitle TK` | 应用名称 | `src/config/index.ts` |
| `NEXT_PUBLIC_THEME` | ❌ | `default` | 主题 | `src/config/index.ts` |
| `NEXT_PUBLIC_APPEARANCE` | ❌ | `system` | 外观模式 (system/light/dark) | `src/config/index.ts` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | ❌ | `en` | 默认语言 (en/zh/fr) | `src/config/index.ts` |
| `NEXT_PUBLIC_DEBUG` | ❌ | `false` | 调试模式 | `src/app/layout.tsx` |

---

## 数据库配置

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `DATABASE_URL` | ✅ | - | 数据库连接 URL | `src/config/index.ts`, `src/core/db/index.ts` |
| `DATABASE_PROVIDER` | ❌ | `postgresql` | 数据库提供商 (postgresql/mysql/sqlite) | `src/config/index.ts` |
| `DB_SINGLETON_ENABLED` | ❌ | `false` | 数据库单例模式 | `src/config/index.ts` |
| `HYPERDRIVE` | ❌ | - | Cloudflare Hyperdrive 连接（仅 Cloudflare Workers） | `src/core/db/index.ts` |

---

## 认证配置

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `AUTH_SECRET` | ✅ | - | 认证密钥（生成: `openssl rand -base64 32`） | `src/config/index.ts` |
| `AUTH_URL` | ❌ | `NEXT_PUBLIC_APP_URL` | 认证 URL | `src/config/index.ts` |
| `GOOGLE_CLIENT_ID` | ❌ | - | Google OAuth Client ID | 数据库配置（可通过环境变量） |
| `GOOGLE_CLIENT_SECRET` | ❌ | - | Google OAuth Client Secret | 数据库配置（可通过环境变量） |
| `GITHUB_CLIENT_ID` | ❌ | - | GitHub OAuth Client ID | 数据库配置（可通过环境变量） |
| `GITHUB_CLIENT_SECRET` | ❌ | - | GitHub OAuth Client Secret | 数据库配置（可通过环境变量） |

**注意**: Google 和 GitHub OAuth 配置主要通过数据库存储，但也可以通过环境变量设置。

---

## 支付配置

### Creem 支付

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `CREEM_ENABLED` | ❌ | - | 启用 Creem 支付 | `src/shared/models/config.ts` |
| `CREEM_ENVIRONMENT` | ❌ | - | 环境 (sandbox/production) | `src/shared/models/config.ts` |
| `CREEM_API_KEY` | ❌ | - | Creem API Key | `src/shared/models/config.ts` |
| `CREEM_SIGNING_SECRET` | ❌ | - | Creem 签名密钥 | `src/shared/models/config.ts` |
| `CREEM_PRODUCT_IDS` | ❌ | - | Creem 产品 ID（JSON 格式） | `src/shared/models/config.ts` |

### Stripe 支付

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `STRIPE_ENABLED` | ❌ | - | 启用 Stripe 支付 | `src/shared/models/config.ts` |
| `STRIPE_SECRET_KEY` | ❌ | - | Stripe 密钥 | `src/shared/models/config.ts` |
| `STRIPE_PUBLISHABLE_KEY` | ❌ | - | Stripe 公开密钥 | `src/shared/models/config.ts` |
| `STRIPE_SIGNING_SECRET` | ❌ | - | Stripe Webhook 签名密钥 | `src/shared/models/config.ts` |

### PayPal 支付

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `PAYPAL_ENABLED` | ❌ | - | 启用 PayPal 支付 | `src/shared/models/config.ts` |
| `PAYPAL_CLIENT_ID` | ❌ | - | PayPal Client ID | `src/shared/models/config.ts` |
| `PAYPAL_CLIENT_SECRET` | ❌ | - | PayPal Client Secret | `src/shared/models/config.ts` |
| `PAYPAL_ENVIRONMENT` | ❌ | - | PayPal 环境 (sandbox/live) | `src/shared/models/config.ts` |

### 通用支付配置

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `DEFAULT_PAYMENT_PROVIDER` | ❌ | - | 默认支付提供商 (creem/stripe/paypal) | `src/shared/models/config.ts` |
| `SELECT_PAYMENT_ENABLED` | ❌ | - | 允许用户选择支付方式 | `src/shared/models/config.ts` |

---

## RapidAPI 配置

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `NEXT_PUBLIC_RAPIDAPI_KEY` | ✅ | - | RapidAPI API Key | `src/shared/services/media/rapidapi.ts` |
| `NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_DOWNLOAD` | ❌ | `tiktok-video-no-watermark2.p.rapidapi.com` | TikTok 视频下载 Host | `src/shared/services/media/rapidapi.ts` |
| `NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_TRANSCRIPT` | ❌ | `tiktok-transcriptor-api3.p.rapidapi.com` | TikTok 文案提取 Host | `src/shared/services/media/rapidapi.ts` |
| `NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT` | ❌ | `youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com` | YouTube 文案提取 Host | `src/shared/services/media/rapidapi.ts` |
| `NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_DOWNLOAD` | ❌ | `youtube-video-and-shorts-downloader1.p.rapidapi.com` | YouTube 视频下载 Host | `src/shared/services/media/rapidapi.ts` |

---

## AI 服务配置

### Gemini 翻译

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `GEMINI_API_KEY` | ✅ | - | Google Gemini API Key | `src/shared/services/media/gemini-translator.ts` |
| `GEMINI_BASE_URL` | ❌ | - | Gemini API 基础 URL（可选） | `src/shared/services/media/gemini-translator.ts` |

---

## 存储配置

### Vercel Blob

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `BLOB_READ_WRITE_TOKEN` | ❌ | - | Vercel Blob 读写令牌 | `src/extensions/storage/vercel-blob.ts`, `src/shared/services/storage.ts` |
| `STORAGE_PROVIDER` | ❌ | - | 存储提供商 (vercel-blob/r2/s3) | `src/shared/services/storage.ts` |

**注意**: R2 和 S3 配置通过数据库存储，不使用环境变量。

---

## 邮件配置

### Resend

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `RESEND_API_KEY` | ❌ | - | Resend API Key | 数据库配置（可通过环境变量） |
| `RESEND_DEFAULT_FROM` | ❌ | - | Resend 默认发件人 | 数据库配置（可通过环境变量） |

**注意**: Resend 配置主要通过数据库存储，但也可以通过环境变量设置。

---

## 系统环境变量

| 变量名 | 必需 | 默认值 | 说明 | 使用位置 |
|--------|------|--------|------|----------|
| `NODE_ENV` | ❌ | - | Node.js 环境 (development/production) | `src/app/layout.tsx`, `src/shared/lib/env.ts` |
| `VERCEL` | ❌ | - | 是否在 Vercel 环境运行 | `next.config.mjs` |
| `ANALYZE` | ❌ | - | 启用 Bundle 分析 | `next.config.mjs` |
| `NEXT_RUNTIME` | ❌ | - | Next.js 运行时标识 | `src/config/index.ts` |

---

## 📝 必需环境变量总结

### 最小配置（必需）

```env
# 基础配置
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# 认证
AUTH_SECRET=your-auth-secret-key-here

# RapidAPI（用于视频和字幕提取）
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key

# Gemini（用于翻译）
GEMINI_API_KEY=your-gemini-api-key
```

### 完整配置示例

```env
# ============================================
# 基础应用配置
# ============================================
NEXT_PUBLIC_APP_URL=https://subtitletk.app
NEXT_PUBLIC_APP_NAME=Subtitle TK
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_THEME=default
NEXT_PUBLIC_APPEARANCE=system
NEXT_PUBLIC_DEBUG=false

# ============================================
# 数据库配置
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/subtitle_tk
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=false

# ============================================
# 认证配置
# ============================================
AUTH_SECRET=your-auth-secret-key-here
AUTH_URL=https://subtitletk.app

# Google OAuth（可选）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth（可选）
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# ============================================
# RapidAPI 配置
# ============================================
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key
NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_DOWNLOAD=tiktok-video-no-watermark2.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_TRANSCRIPT=tiktok-transcriptor-api3.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT=youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com
NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_DOWNLOAD=youtube-video-and-shorts-downloader1.p.rapidapi.com

# ============================================
# AI 服务配置
# ============================================
GEMINI_API_KEY=your-gemini-api-key
GEMINI_BASE_URL=

# ============================================
# 存储配置
# ============================================
BLOB_READ_WRITE_TOKEN=vercel_blob_xxx
STORAGE_PROVIDER=vercel-blob

# ============================================
# 支付配置 - Creem
# ============================================
CREEM_ENABLED=true
CREEM_ENVIRONMENT=production
CREEM_API_KEY=your-creem-api-key
CREEM_SIGNING_SECRET=your-creem-signing-secret
CREEM_PRODUCT_IDS={"starter-monthly":"prod_2tOrusjFjkm0WaOn9waSCP","base-monthly":"prod_52so9q1usRp5ZfDZ0vIBru","pro-monthly":"prod_6Wo2c7ZLGrOcz1jGrSqhi0"}

# ============================================
# 支付配置 - Stripe（可选）
# ============================================
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=sk_xxx
STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_SIGNING_SECRET=whsec_xxx

# ============================================
# 支付配置 - PayPal（可选）
# ============================================
PAYPAL_ENABLED=false
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_ENVIRONMENT=sandbox

# ============================================
# 通用支付配置
# ============================================
DEFAULT_PAYMENT_PROVIDER=creem
SELECT_PAYMENT_ENABLED=false

# ============================================
# 邮件配置 - Resend（可选）
# ============================================
RESEND_API_KEY=re_xxx
RESEND_DEFAULT_FROM=noreply@subtitletk.app

# ============================================
# 系统环境变量
# ============================================
NODE_ENV=production
```

---

## 🔍 环境变量优先级

1. **环境变量** > **数据库配置**（支付相关配置）
2. **数据库配置** > **默认值**（其他配置）

---

## 📌 注意事项

1. **`NEXT_PUBLIC_*` 前缀**: 这些变量会暴露到浏览器端，不要存储敏感信息
2. **支付配置**: Creem、Stripe、PayPal 的配置优先从环境变量读取，确保安全性
3. **数据库配置**: Google OAuth、GitHub OAuth、Resend 等主要通过数据库配置，环境变量仅作为备选
4. **Cloudflare Workers**: 如果部署到 Cloudflare Workers，可以使用 `HYPERDRIVE` 环境变量
5. **Vercel 部署**: Vercel 会自动设置 `VERCEL` 环境变量，并可通过 Vercel Dashboard 配置 `BLOB_READ_WRITE_TOKEN`

---

## 🔗 相关文档

- `env.example.txt` - 环境变量示例文件
- `ENV_SETUP.md` - 环境变量设置指南
- `ENV_VARIABLES.md` - 详细环境变量说明（包含更多可选配置）

