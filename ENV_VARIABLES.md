# 环境变量配置说明

本文档列出了项目所需的所有环境变量配置。

## 📋 目录

- [基础应用配置](#基础应用配置)
- [数据库配置](#数据库配置)
- [认证配置](#认证配置)
- [支付配置](#支付配置)
- [存储配置](#存储配置)
- [邮件配置](#邮件配置)
- [AI 服务配置](#ai-服务配置)
- [分析统计配置](#分析统计配置)
- [广告配置](#广告配置)
- [联盟营销配置](#联盟营销配置)
- [客服配置](#客服配置)

---

## 基础应用配置

```env
# 应用 URL（必需）
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 应用名称（可选，默认: Subtitle TK）
NEXT_PUBLIC_APP_NAME=Subtitle TK

# 主题（可选，默认: default）
NEXT_PUBLIC_THEME=default

# 外观模式（可选，默认: system）
# 可选值: system, light, dark
NEXT_PUBLIC_APPEARANCE=system

# 默认语言（可选，默认: en）
# 可选值: en, zh, fr
NEXT_PUBLIC_DEFAULT_LOCALE=en

# 调试模式（可选，默认: false）
NEXT_PUBLIC_DEBUG=false
```

---

## 数据库配置

```env
# 数据库连接 URL（必需）
# PostgreSQL 示例: postgresql://user:password@localhost:5432/dbname
# MySQL 示例: mysql://user:password@localhost:3306/dbname
# SQLite 示例: file:./local.db
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# 数据库提供商（可选，默认: postgresql）
# 可选值: postgresql, mysql, sqlite
DATABASE_PROVIDER=postgresql

# 数据库单例模式（可选，默认: false）
DB_SINGLETON_ENABLED=false
```

---

## 认证配置

```env
# 认证 URL（可选，默认使用 NEXT_PUBLIC_APP_URL）
AUTH_URL=http://localhost:3000

# 认证密钥（必需）
# 生成命令: openssl rand -base64 32
AUTH_SECRET=your-auth-secret-key-here

# 邮箱认证启用（可选，默认: true）
# 通过数据库配置，无需环境变量

# Google 认证配置
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub 认证配置
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

---

## 支付配置

### Creem 支付

```env
# Creem 支付启用（可选）
CREEM_ENABLED=true

# Creem 环境（可选，默认: sandbox）
# 可选值: sandbox, production
CREEM_ENVIRONMENT=sandbox

# Creem API 密钥（必需，如果启用）
CREEM_API_KEY=creem_test_xxx

# Creem Webhook 签名密钥（必需，如果启用）
CREEM_SIGNING_SECRET=whsec_xxx

# Creem 产品 ID 映射（必需，如果启用）
# JSON 格式字符串，映射定价表中的 product_id 到 Creem 的产品 ID
CREEM_PRODUCT_IDS={"standard-monthly":"prod_xxx","premium-monthly":"prod_xxx"}
```

### Stripe 支付

```env
# Stripe 支付启用（可选）
STRIPE_ENABLED=true

# Stripe 密钥（必需，如果启用）
STRIPE_SECRET_KEY=sk_test_xxx

# Stripe 公钥（必需，如果启用）
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Stripe Webhook 签名密钥（必需，如果启用）
STRIPE_SIGNING_SECRET=whsec_xxx
```

### PayPal 支付

```env
# PayPal 支付启用（可选）
PAYPAL_ENABLED=true

# PayPal 客户端 ID（必需，如果启用）
PAYPAL_CLIENT_ID=your-paypal-client-id

# PayPal 客户端密钥（必需，如果启用）
PAYPAL_CLIENT_SECRET=your-paypal-client-secret

# PayPal 环境（可选，默认: sandbox）
# 可选值: sandbox, production
PAYPAL_ENVIRONMENT=sandbox
```

### 支付通用配置

```env
# 默认支付提供商（可选）
# 可选值: creem, stripe, paypal
DEFAULT_PAYMENT_PROVIDER=creem

# 是否允许用户选择支付方式（可选）
SELECT_PAYMENT_ENABLED=false
```

---

## 存储配置

### Cloudflare R2

```env
# R2 存储启用（可选）
R2_ENABLED=true

# R2 账户 ID（必需，如果启用）
R2_ACCOUNT_ID=your-r2-account-id

# R2 访问密钥 ID（必需，如果启用）
R2_ACCESS_KEY_ID=your-r2-access-key-id

# R2 密钥（必需，如果启用）
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# R2 存储桶名称（必需，如果启用）
R2_BUCKET=your-r2-bucket-name

# R2 区域（可选，默认: auto）
R2_REGION=auto

# R2 端点（可选）
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# R2 公共域名（可选）
R2_PUBLIC_DOMAIN=https://your-custom-domain.com
```

### AWS S3

```env
# S3 存储启用（可选）
S3_ENABLED=true

# S3 端点（必需，如果启用）
S3_ENDPOINT=https://s3.amazonaws.com

# S3 区域（必需，如果启用）
S3_REGION=us-east-1

# S3 访问密钥 ID（必需，如果启用）
S3_ACCESS_KEY_ID=your-s3-access-key-id

# S3 密钥（必需，如果启用）
S3_SECRET_ACCESS_KEY=your-s3-secret-access-key

# S3 存储桶名称（必需，如果启用）
S3_BUCKET=your-s3-bucket-name

# S3 公共域名（可选）
S3_PUBLIC_DOMAIN=https://your-custom-domain.com
```

---

## 邮件配置

### Resend

```env
# Resend 邮件启用（可选）
RESEND_ENABLED=true

# Resend API 密钥（必需，如果启用）
RESEND_API_KEY=re_xxx

# Resend 默认发件人（可选）
RESEND_DEFAULT_FROM=noreply@example.com
```

---

## AI 服务配置

### OpenRouter

```env
# OpenRouter 启用（可选）
OPENROUTER_ENABLED=true

# OpenRouter API 密钥（必需，如果启用）
OPENROUTER_API_KEY=sk-or-v1-xxx
```

### Replicate

```env
# Replicate 启用（可选）
REPLICATE_ENABLED=true

# Replicate API 密钥（必需，如果启用）
REPLICATE_API_KEY=r8_xxx
```

### Fal

```env
# Fal 启用（可选）
FAL_ENABLED=true

# Fal API 密钥（必需，如果启用）
FAL_API_KEY=your-fal-api-key
```

### Kie

```env
# Kie 启用（可选）
KIE_ENABLED=true

# Kie API 密钥（必需，如果启用）
KIE_API_KEY=your-kie-api-key
```

---

## 分析统计配置

### Google Analytics

```env
# Google Analytics 启用（可选）
GOOGLE_ANALYTICS_ENABLED=true

# Google Analytics ID（必需，如果启用）
GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

### Microsoft Clarity

```env
# Clarity 启用（可选）
CLARITY_ENABLED=true

# Clarity 项目 ID（必需，如果启用）
CLARITY_PROJECT_ID=your-clarity-project-id
```

### Plausible Analytics

```env
# Plausible 启用（可选）
PLAUSIBLE_ENABLED=true

# Plausible 域名（必需，如果启用）
PLAUSIBLE_DOMAIN=your-domain.com

# Plausible API 密钥（可选）
PLAUSIBLE_API_KEY=your-plausible-api-key
```

### OpenPanel

```env
# OpenPanel 启用（可选）
OPENPANEL_ENABLED=true

# OpenPanel 客户端 ID（必需，如果启用）
OPENPANEL_CLIENT_ID=your-openpanel-client-id

# OpenPanel 客户端密钥（必需，如果启用）
OPENPANEL_CLIENT_SECRET=your-openpanel-client-secret
```

### Vercel Analytics

Vercel Analytics 无需配置环境变量，在 Vercel 平台上部署时会自动启用。

---

## 广告配置

### Google AdSense

```env
# AdSense 启用（可选）
ADSENSE_ENABLED=true

# AdSense 客户端 ID（必需，如果启用）
ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
```

---

## 联盟营销配置

### Affonso

```env
# Affonso 启用（可选）
AFFONSO_ENABLED=true

# Affonso API 密钥（必需，如果启用）
AFFONSO_API_KEY=your-affonso-api-key
```

### PromoteKit

```env
# PromoteKit 启用（可选）
PROMOTEKIT_ENABLED=true

# PromoteKit API 密钥（必需，如果启用）
PROMOTEKIT_API_KEY=your-promotekit-api-key
```

---

## 客服配置

### Crisp

```env
# Crisp 启用（可选）
CRISP_ENABLED=true

# Crisp 网站 ID（必需，如果启用）
CRISP_WEBSITE_ID=your-crisp-website-id
```

### Tawk

```env
# Tawk 启用（可选）
TAWK_ENABLED=true

# Tawk 属性 ID（必需，如果启用）
TAWK_PROPERTY_ID=your-tawk-property-id

# Tawk Widget ID（必需，如果启用）
TAWK_WIDGET_ID=your-tawk-widget-id
```

---

## 📝 使用说明

1. **创建环境变量文件**
   - 开发环境: 创建 `.env.development` 文件
   - 生产环境: 创建 `.env.production` 文件或在部署平台配置环境变量

2. **必需变量**
   - `DATABASE_URL` - 数据库连接字符串
   - `AUTH_SECRET` - 认证密钥（使用 `openssl rand -base64 32` 生成）
   - `NEXT_PUBLIC_APP_URL` - 应用 URL

3. **可选变量**
   - 根据你使用的功能，配置相应的服务环境变量
   - 未配置的服务将保持禁用状态

4. **安全提示**
   - ⚠️ 不要将包含敏感信息的 `.env` 文件提交到 Git
   - ⚠️ 生产环境使用强密码和密钥
   - ⚠️ 定期轮换 API 密钥和密码

5. **优先级说明**
   - 环境变量优先级高于数据库配置
   - 如果同时配置了环境变量和数据库配置，环境变量会优先使用

---

## 🔗 相关文档

- [Creem 配置指南](./ENV_CREEM_CONFIG.md)
- [API 配置文档](./scripts/API_CONFIGURATION.md)



