# SubtitleTK API Configuration Guide

## 已配置的 API 密钥

所有 API 配置已成功保存到数据库。以下是配置详情：

### 1. RapidAPI Media Key

**用途**: TikTok 和 YouTube 视频字幕提取和下载

**配置名称**: `rapidapi_media_key`

**密钥值**: `558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b`

**使用的端点**:
- **YouTube 字幕提取**: 
  - `GET https://youtube-transcriptor.p.rapidapi.com/transcript?video_id={video_id}&lang=en`
  - Header: `x-rapidapi-host: youtube-transcriptor.p.rapidapi.com`
  - Header: `x-rapidapi-key: {rapidapi_media_key}`

- **TikTok 字幕提取**: 
  - `POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php`
  - Header: `x-rapidapi-host: tiktok-transcriptor-api3.p.rapidapi.com`
  - Header: `x-rapidapi-key: {rapidapi_media_key}`
  - Body: `{"url": "{tiktok_url}"}`

- **TikTok 视频下载**: 
  - `GET https://tiktok-download-video1.p.rapidapi.com/getVideo?url={tiktok_url}`
  - Header: `x-rapidapi-host: tiktok-download-video1.p.rapidapi.com`
  - Header: `x-rapidapi-key: {rapidapi_media_key}`

**验证位置**: Admin Settings → AI Tab → RapidAPI Media Key

---

### 2. Google OAuth Credentials

**用途**: 用户登录和注册（Google 登录）

**配置名称**: 
- `google_client_id`
- `google_client_secret`

**客户端 ID**: `40529785238-9b7fe5kiiohn6hd9fspos1hv68hu45gi.apps.googleusercontent.com`

**客户端密钥**: `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`

**Google Cloud Console**: https://console.cloud.google.com/

**验证位置**: Admin Settings → Auth Tab → Google Auth

**启用步骤**:
1. 在 Admin Settings → Auth 页面
2. 启用 "Google Auth Enabled" 开关
3. 可选：启用 "OneTap Enabled" 以使用 Google One Tap 登录

---

### 3. Google Translate API Key

**用途**: 字幕翻译功能

**配置名称**: `google_translate_api_key`

**API 密钥**: `AIzaSyCA-W43UHCzRUUKM5ny9kdgPAtTL0dHvLY`

**Google AI Studio**: https://aistudio.google.com/app/api-keys

**验证位置**: Admin Settings → AI Tab → Google Translate API Key

**功能**: 
- 将提取的字幕翻译成目标语言
- 支持 12+ 种语言翻译
- 每次翻译消耗 1 积分

---

## 配置更新方法

### 方法 1: 使用脚本（推荐）

```bash
# 编辑 scripts/update-api-configs.ts 文件
# 修改配置值，然后运行：
npx tsx scripts/update-api-configs.ts
```

### 方法 2: 通过 Admin 界面

1. 登录 Admin 账户
2. 访问 `/admin/settings/ai` (RapidAPI 和 Google Translate)
3. 访问 `/admin/settings/auth` (Google OAuth)
4. 更新相应的配置值
5. 点击保存

### 方法 3: 直接数据库操作

```sql
-- 更新 RapidAPI Key
UPDATE config SET value = '558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b' WHERE name = 'rapidapi_media_key';

-- 更新 Google Client ID
UPDATE config SET value = '40529785238-9b7fe5kiiohn6hd9fspos1hv68hu45gi.apps.googleusercontent.com' WHERE name = 'google_client_id';

-- 更新 Google Client Secret
UPDATE config SET value = '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' WHERE name = 'google_client_secret';

-- 更新 Google Translate API Key
UPDATE config SET value = 'AIzaSyCA-W43UHCzRUUKM5ny9kdgPAtTL0dHvLY' WHERE name = 'google_translate_api_key';
```

---

## API 端点使用说明

### YouTube 字幕提取流程

1. **提取视频 ID**: 从 URL `https://youtu.be/mJ8kgZoNGjg` 提取 `mJ8kgZoNGjg`
2. **调用 RapidAPI**: 
   ```
   GET https://youtube-transcriptor.p.rapidapi.com/transcript?video_id=mJ8kgZoNGjg&lang=en
   ```
3. **处理响应**: 解析返回的字幕数据并生成 SRT 文件

### TikTok 字幕提取流程

1. **解析 URL**: 处理 TikTok URL（包括短链接）
2. **调用 RapidAPI**: 
   ```
   POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php
   Body: {"url": "https://www.tiktok.com/@Dasher/video/7574110549382909201"}
   ```
3. **处理响应**: 解析返回的字幕数据并生成 SRT 文件

### TikTok 视频下载流程

1. **解析 URL**: 处理 TikTok URL
2. **调用 RapidAPI**: 
   ```
   GET https://tiktok-download-video1.p.rapidapi.com/getVideo?url={tiktok_url}
   ```
3. **下载视频**: 接收视频文件并上传到存储服务

### 字幕翻译流程

1. **准备字幕数据**: 将 SRT 文件解析为字幕项数组
2. **调用 Google Translate API**: 
   - 使用 `google_translate_api_key` 进行 API 调用
   - 批量翻译字幕文本（每批 4000 字符）
3. **生成翻译 SRT**: 将翻译结果重新组装为 SRT 文件

---

## 安全注意事项

1. **密钥保护**: 
   - 所有 API 密钥存储在数据库中
   - 密钥字段在 Admin 界面中显示为密码类型（隐藏）
   - 不要将密钥提交到版本控制系统

2. **访问控制**: 
   - 只有具有 `SETTINGS_WRITE` 权限的 Admin 用户可以修改配置
   - 普通用户无法访问配置页面

3. **密钥轮换**: 
   - 定期检查 API 使用情况
   - 如果密钥泄露，立即在 Google Cloud Console 或 RapidAPI 中撤销并重新生成

---

## 故障排查

### RapidAPI 返回错误

1. **检查密钥**: 确认 `rapidapi_media_key` 配置正确
2. **检查配额**: 确认 RapidAPI 账户有足够的配额
3. **检查端点**: 确认使用的端点 URL 正确

### Google OAuth 不工作

1. **检查配置**: 确认 `google_client_id` 和 `google_client_secret` 正确
2. **检查回调 URL**: 在 Google Cloud Console 中配置正确的回调 URL
3. **启用开关**: 确认在 Admin Settings 中启用了 Google Auth

### Google Translate 失败

1. **检查 API 密钥**: 确认 `google_translate_api_key` 正确
2. **检查配额**: 确认 Google Cloud 项目有足够的配额
3. **检查 API 启用**: 确认 Google Cloud Translation API 已启用

---

## 配置验证

运行以下命令验证配置是否正确：

```bash
# 检查配置是否已保存
npx tsx -e "
import { getConfigs } from './src/shared/models/config.ts';
const configs = await getConfigs();
console.log('RapidAPI Key:', configs.rapidapi_media_key ? '✅ Set' : '❌ Missing');
console.log('Google Client ID:', configs.google_client_id ? '✅ Set' : '❌ Missing');
console.log('Google Translate Key:', configs.google_translate_api_key ? '✅ Set' : '❌ Missing');
"
```

---

## 4. Creem Payment Configuration

**用途**: 支付处理（订阅和一次性付款）

**配置名称**: 
- `creem_enabled`
- `creem_environment`
- `creem_api_key`
- `creem_product_ids`
- `creem_signing_secret` (需要在设置 webhook 后配置)

**API 密钥**: `creem_test_6449uLShhyL3U6HVnhuasm`

**环境**: `sandbox` (测试环境)

**产品映射**:
```json
{
  "standard-monthly": "prod_7c1FZHQeCCFczvNU5dYWEj",  // Professional Plan - $19.9 USD
  "premium-monthly": "prod_1pM4Co56OhCMC7EkwMjVf"     // Ultima Plan - $59.9 USD
}
```

**Creem Dashboard**: https://www.creem.io/dashboard/developers

**测试支付链接**:
- Professional Plan ($19.9): https://www.creem.io/test/payment/prod_7c1FZHQeCCFczvNU5dYWEj
- Ultima Plan ($59.9): https://www.creem.io/test/payment/prod_1pM4Co56OhCMC7EkwMjVf

**验证位置**: Admin Settings → Payment Tab → Creem

**启用步骤**:
1. 在 Admin Settings → Payment 页面
2. 启用 "Creem Enabled" 开关
3. 设置 "Creem Environment" 为 `sandbox` (测试) 或 `production` (生产)
4. 配置 "Creem Product IDs Mapping" JSON
5. 设置 webhook 后配置 "Creem Signing Secret"

**Webhook 配置**:
- Webhook URL: `{your_domain}/api/payment/notify/creem`
- 需要在 Creem Dashboard 中配置 webhook URL
- 配置 webhook 后，将 Signing Secret 添加到配置中

---

## 更新日期

**最后更新**: 2025-12-24

**更新方式**: 脚本自动更新

**状态**: ✅ 所有配置已成功保存到数据库

