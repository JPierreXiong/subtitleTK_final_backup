# 环境变量配置指南

## 📋 快速开始

### 1. 复制环境变量示例文件

```bash
# Windows PowerShell
Copy-Item env.example.txt .env.local

# Linux/Mac
cp env.example.txt .env.local
```

### 2. 编辑 `.env.local` 文件

打开 `.env.local` 文件，填写所有必需的环境变量值。

## 🔑 必需的环境变量

以下环境变量是**必须配置**的，否则应用无法正常运行：

### 基础配置
- `DATABASE_URL` - 数据库连接字符串
- `AUTH_SECRET` - 认证密钥（使用 `openssl rand -base64 32` 生成）
- `NEXT_PUBLIC_APP_URL` - 应用 URL

### API 配置
- `NEXT_PUBLIC_RAPIDAPI_KEY` - RapidAPI 密钥（用于视频和字幕提取）
- `GEMINI_API_KEY` - Google Gemini API 密钥（用于字幕翻译）

### 存储配置（至少选择一个）
- **Vercel Blob**（推荐）: `BLOB_READ_WRITE_TOKEN`
- **Cloudflare R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- **AWS S3**: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`

## 📝 详细配置说明

### 数据库配置

```env
# PostgreSQL 示例
DATABASE_URL=postgresql://用户名:密码@localhost:5432/数据库名

# 示例
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/subtitle_tk
```

### 认证密钥生成

```bash
# Windows PowerShell
openssl rand -base64 32

# Linux/Mac
openssl rand -base64 32
```

将生成的密钥填入 `AUTH_SECRET`。

### RapidAPI 配置

1. 访问 [RapidAPI](https://rapidapi.com/)
2. 注册账号并订阅以下 API：
   - TikTok Video Download API
   - TikTok Transcriptor API
   - YouTube Transcripts API
   - YouTube Video Download API
3. 获取 API Key 并填入 `NEXT_PUBLIC_RAPIDAPI_KEY`

### Gemini API 配置

1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建 API Key
3. 将 API Key 填入 `GEMINI_API_KEY`

### Vercel Blob 配置（推荐）

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入 Storage → Blob
3. 创建 Blob Store
4. 在 Settings 中获取 Read/Write Token
5. 将 Token 填入 `BLOB_READ_WRITE_TOKEN`

### Cloudflare R2 配置

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 R2 → Create Bucket
3. 创建 API Token（需要 R2:Edit 权限）
4. 填写以下环境变量：
   - `R2_ACCOUNT_ID` - Cloudflare Account ID
   - `R2_ACCESS_KEY_ID` - API Token Access Key ID
   - `R2_SECRET_ACCESS_KEY` - API Token Secret Access Key
   - `R2_BUCKET_NAME` - Bucket 名称

## ✅ 配置检查清单

在启动应用前，请确认以下配置：

- [ ] `DATABASE_URL` 已配置且可连接
- [ ] `AUTH_SECRET` 已生成并配置
- [ ] `NEXT_PUBLIC_APP_URL` 已配置
- [ ] `NEXT_PUBLIC_RAPIDAPI_KEY` 已配置
- [ ] `GEMINI_API_KEY` 已配置
- [ ] 至少一个存储提供商已配置（Vercel Blob / R2 / S3）

## 🔒 安全提示

1. **不要提交敏感信息**
   - `.env.local` 文件已在 `.gitignore` 中
   - 不要将包含真实密钥的文件提交到 Git

2. **生产环境安全**
   - 使用强密码和密钥
   - 定期轮换 API 密钥
   - 使用环境变量管理工具（如 Vercel Environment Variables）

3. **密钥管理**
   - 开发环境：使用 `.env.local`
   - 生产环境：使用部署平台的环境变量配置

## 🚀 启动应用

配置完成后，启动开发服务器：

```bash
pnpm install
pnpm run dev
```

应用将在 `http://localhost:3000` 启动。

## 📚 更多信息

- 详细的环境变量说明请参考 `ENV_VARIABLES.md`
- API 配置说明请参考 `scripts/API_CONFIGURATION.md`

