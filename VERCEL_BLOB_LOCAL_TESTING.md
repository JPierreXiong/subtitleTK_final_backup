# Vercel Blob 本地测试指南

## 📋 配置检查清单

### ✅ 1. 环境变量配置

**文件位置**: `.env.local` (项目根目录)

**内容**:
```bash
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_AWbQIjPEWVIazH0h_hnO7SXeV47fRjeAG9EMkF4OkwVBlDL"
```

**注意**:
- ✅ Token 已配置
- ✅ 文件在 `.gitignore` 中，不会被提交到 Git
- ✅ Next.js 会自动读取 `.env.local` 文件

### ✅ 2. 依赖安装

**已安装**: `@vercel/blob@2.0.0`

**验证命令**:
```bash
pnpm list @vercel/blob
```

### ✅ 3. 代码配置

**存储提供者优先级**:
1. **Vercel Blob** (如果配置了 Token，自动优先使用)
2. 原始视频 URL (如果 Vercel Blob 失败)

**配置位置**:
- `src/shared/services/storage.ts` - 存储服务初始化
- `src/shared/services/media/video-storage.ts` - 视频上传逻辑

---

## 🧪 本地测试步骤

### 步骤 1: 启动开发服务器

```bash
pnpm dev
```

**预期结果**:
- 服务器启动成功
- 没有环境变量错误

### 步骤 2: 测试视频上传

1. **访问媒体提取页面**
   - 打开浏览器，访问媒体提取功能页面

2. **输入 TikTok 视频 URL**
   - 例如: `https://www.tiktok.com/@username/video/1234567890`

3. **选择输出类型**
   - 选择 **"Video (TikTok only)"**

4. **点击 "Extract" 按钮**

5. **观察控制台日志**
   - 查看浏览器控制台 (F12)
   - 查看服务器终端日志
   - 查找以下日志:
     - `TikTok video download API response:` - API 响应
     - `Vercel Blob upload success` - 上传成功
     - `Using original video URL` - 如果上传失败

### 步骤 3: 验证上传结果

**成功标志**:
- ✅ 任务状态变为 "extracted"
- ✅ 显示 "Video Ready for Download" 按钮
- ✅ 点击下载按钮可以下载视频
- ✅ 视频 URL 格式: `vercel-blob:https://...public.blob.vercel-storage.com/...`

**失败标志**:
- ⚠️ 显示 "Using original video URL"
- ⚠️ 视频 URL 格式: `original:https://...`

---

## 🔍 调试技巧

### 1. 检查环境变量是否加载

在代码中添加临时日志（测试后删除）:

```typescript
// src/shared/services/storage.ts
console.log('BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? 'Found' : 'Not found');
```

### 2. 检查存储提供者初始化

在浏览器控制台查看:
- 打开 Network 标签
- 查看 `/api/media/submit` 请求
- 检查响应中的错误信息

### 3. 查看服务器日志

在终端中查看:
- Vercel Blob 上传日志
- API 响应格式
- 错误堆栈信息

---

## 🐛 常见问题

### 问题 1: "BLOB_READ_WRITE_TOKEN is required"

**原因**: 环境变量未正确加载

**解决方案**:
1. 确认 `.env.local` 文件存在
2. 重启开发服务器 (`pnpm dev`)
3. 检查 Token 格式是否正确（不要有多余的空格）

### 问题 2: "Failed to upload video to Vercel Blob"

**原因**: 
- Token 无效
- 网络问题
- Vercel Blob 服务问题

**解决方案**:
1. 验证 Token 是否正确（从 Vercel Dashboard 复制）
2. 检查网络连接
3. 查看详细错误信息

### 问题 3: 视频上传超时

**原因**: 
- 视频文件太大
- Vercel Serverless Function 超时限制（Hobby 计划约 10 秒）

**解决方案**:
1. 先测试小视频（<10MB）
2. 如果大视频超时，考虑升级到 Vercel Pro 计划
3. 或者使用原始视频 URL（自动回退）

---

## 📊 测试结果记录

### 测试 1: 小视频 (<10MB)
- [ ] 上传成功
- [ ] 下载成功
- [ ] URL 格式正确

### 测试 2: 中等视频 (10-50MB)
- [ ] 上传成功
- [ ] 下载成功
- [ ] 无超时错误

### 测试 3: 大视频 (>50MB)
- [ ] 上传成功/失败
- [ ] 错误信息清晰
- [ ] 回退机制正常

---

## 🚀 下一步

测试完成后:
1. ✅ 确认功能正常
2. ✅ 记录测试结果
3. ✅ 准备部署到 Vercel Production
4. ✅ 在 Vercel Dashboard 配置环境变量

---

## 📝 注意事项

1. **Token 安全**
   - ✅ `.env.local` 已在 `.gitignore` 中
   - ❌ 不要将 Token 提交到 Git
   - ❌ 不要分享 Token

2. **本地开发**
   - ✅ 使用 `.env.local` 文件
   - ✅ Next.js 会自动加载
   - ✅ 重启服务器后生效

3. **生产环境**
   - ✅ 在 Vercel Dashboard 配置环境变量
   - ✅ 不需要 `.env.local` 文件
   - ✅ Vercel 会自动注入环境变量

---

**最后更新**: 2024-12-25
**状态**: ✅ 已配置，可以开始测试

