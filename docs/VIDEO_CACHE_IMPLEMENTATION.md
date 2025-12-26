# 视频缓存功能实施总结

## ✅ 已完成的工作

### 1. 数据库 Schema 扩展

**文件**：`src/config/db/schema.ts`

添加了 `video_cache` 表定义：
- `id`: SHA-256 哈希（标准化 URL 的指纹）
- `originalUrl`: 用户原始输入的 URL
- `downloadUrl`: RapidAPI 返回的视频下载 URL
- `platform`: 平台类型（'youtube' | 'tiktok'）
- `expiresAt`: 缓存过期时间（默认 12 小时）
- 索引：`idx_video_cache_expires` 用于过期清理查询

### 2. URL 标准化工具

**文件**：`src/shared/lib/media-url.ts`

实现了以下函数：
- `normalizeYouTubeUrl()`: 标准化 YouTube URL（处理 youtu.be, shorts 等格式）
- `normalizeTikTokUrl()`: 标准化 TikTok URL（移除追踪参数）
- `normalizeVideoUrl()`: 自动识别平台并标准化
- `generateVideoFingerprint()`: 生成 SHA-256 哈希作为缓存键

### 3. 缓存模型层

**文件**：`src/shared/models/video_cache.ts`

实现了以下函数：
- `findValidVideoCache()`: 查找有效的缓存条目（检查过期时间）
- `setVideoCache()`: 设置或更新缓存条目（使用 upsert 模式）
- `deleteExpiredCacheEntries()`: 清理过期缓存（维护函数）

### 4. API 路由集成

**文件**：`src/app/api/media/submit/route.ts`

在 `processMediaTask` 函数中集成了缓存逻辑：
1. **缓存查找**：对于 `video` 输出类型，先查找缓存
2. **缓存命中**：使用缓存的 `downloadUrl`，但仍调用 API 获取最新 metadata
3. **缓存未命中**：正常调用 API，并将结果存入缓存

### 5. 数据库迁移脚本

**文件**：
- `scripts/create-video-cache-table.sql`: SQL 迁移脚本
- `scripts/create-video-cache-table.ts`: Node.js 执行脚本

---

## 🔄 工作流程

### 视频下载任务（outputType = 'video'）

1. **用户提交任务** → 创建 `media_task` 记录
2. **后台处理开始** → `processMediaTask` 函数
3. **生成指纹** → `generateVideoFingerprint(url)`
4. **查找缓存** → `findValidVideoCache(fingerprint)`
5. **分支处理**：
   - **缓存命中**：
     - 使用缓存的 `downloadUrl`
     - 仍调用 API 获取 metadata（title, author 等）
     - 用缓存的 URL 覆盖 API 返回的 URL
   - **缓存未命中**：
     - 正常调用 RapidAPI
     - 异步保存结果到缓存（12 小时过期）
6. **继续正常流程** → 上传到存储、更新任务状态等

### 字幕提取任务（outputType = 'subtitle'）

- 不适用缓存（字幕内容可能变化）
- 正常调用 RapidAPI

---

## 📊 预期效果

### API 调用节省

**场景假设**：
- 某个热门视频被 10 个用户下载
- 缓存命中率：90%（第 1 次调用 API，后续 9 次使用缓存）

**节省效果**：
- 当前：10 次 API 调用
- 优化后：10 次 API 调用（因为仍需要 metadata）
- ⚠️ **注意**：当前实现仍会调用 API 获取 metadata，主要节省的是**视频下载 URL 的重复获取**

### 进一步优化建议

如果要完全跳过 API 调用，需要：
1. **扩展缓存表**：存储 metadata（title, author, thumbnailUrl 等）
2. **修改逻辑**：缓存命中时完全跳过 API 调用，使用缓存的 metadata 和 downloadUrl
3. **权衡**：metadata 可能变化（视频标题可能更新），需要设置合理的缓存过期策略

---

## 🚀 部署步骤

### 1. 执行数据库迁移

```bash
# 使用 Node.js 脚本执行迁移
npx tsx scripts/create-video-cache-table.ts

# 或直接在数据库控制台执行 SQL
psql "your-connection-string" -f scripts/create-video-cache-table.sql
```

### 2. 验证表创建

```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'video_cache';

-- 检查索引是否存在
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename = 'video_cache';
```

### 3. 部署代码

```bash
# 提交代码
git add .
git commit -m "feat: Add video cache to reduce RapidAPI calls"
git push

# Vercel 会自动部署
```

---

## ⚠️ 注意事项

### 1. 缓存过期策略

- **当前设置**：12 小时
- **原因**：RapidAPI 返回的下载 URL 通常有 6-24 小时有效期
- **调整**：可在 `setVideoCache` 函数中修改 `expiresInHours` 参数

### 2. 缓存清理

定期清理过期缓存以节省存储空间：

```sql
-- 手动清理
DELETE FROM video_cache WHERE expires_at < NOW();

-- 或使用维护函数（在脚本中）
npx tsx -e "import('./src/shared/models/video_cache').then(m => m.deleteExpiredCacheEntries().then(n => console.log('Deleted', n, 'entries')))"
```

### 3. 缓存失效场景

以下情况会导致缓存失效：
- 缓存过期（12 小时后）
- 视频被删除或设为私有（API 返回错误，需要重新获取）
- 数据库手动清理

### 4. 测试建议

1. **功能测试**：
   - 提交相同视频的多个下载任务
   - 验证缓存命中日志（`[Cache Hit]`）
   - 验证缓存未命中日志（`[Cache Miss]`）

2. **性能测试**：
   - 对比缓存命中前后的响应时间
   - 监控 API 调用次数

3. **边界测试**：
   - 测试缓存过期后的行为
   - 测试无效 URL 的处理
   - 测试并发请求的处理

---

## 🔧 后续优化方向

### 短期优化

1. **完全跳过 API 调用**（如上述建议）
2. **添加缓存统计**：记录缓存命中率
3. **优化查询性能**：添加复合索引（platform + expiresAt）

### 长期优化

1. **分布式缓存**：如果有多实例部署，考虑 Redis
2. **缓存预热**：对于热门视频，主动缓存
3. **智能过期**：根据视频热度调整过期时间
4. **元数据缓存**：单独缓存 metadata，避免重复获取

---

**实施日期**：2024-12-19  
**版本**：v1.0

