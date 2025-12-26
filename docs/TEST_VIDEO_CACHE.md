# 视频缓存功能测试指南

## ✅ 核心功能测试结果

已通过基础功能测试：
- ✅ URL 标准化：正常工作（相同 URL 生成相同标准化结果）
- ✅ 指纹生成：正常工作（相同 URL 生成相同 SHA-256 哈希）
- ✅ 缓存设置：正常工作
- ✅ 缓存查找：正常工作

**测试 URL**：`https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc`

**标准化结果**：`https://www.tiktok.com/@Dasher/video/7574110549382909201`

**指纹**：`7ad9b55640ebda24628ea6cc106de4eb...`

---

## 🧪 完整功能测试步骤

### 方法 1：通过前端界面测试（推荐）

1. **启动开发服务器**
   ```bash
   pnpm dev
   ```

2. **访问应用**
   - 打开浏览器：`http://localhost:3000`
   - 登录账号（确保有足够的积分或免费测试次数）

3. **第一次提交（缓存未命中）**
   - 进入媒体提取页面
   - 选择"视频下载"（outputType: 'video'）
   - 输入 URL：`https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc`
   - 提交任务
   - **查看服务器日志**：应该看到 `[Cache Miss] Fetching from RapidAPI for ...`
   - 等待任务完成（可能需要几秒到几十秒）

4. **第二次提交（缓存命中）**
   - 使用**相同的 URL**再次提交视频下载任务
   - **查看服务器日志**：应该看到 `[Cache Hit] Skipping API call for ...`
   - **观察**：任务应该**立即完成**（<100ms），因为跳过了 API 调用

5. **验证缓存数据**
   ```bash
   npx tsx scripts/verify-video-cache-table.ts
   ```
   - 应该看到缓存表中有 1 条记录
   - 检查 `expires_at` 是否为 12 小时后

---

### 方法 2：通过 API 直接测试（需要认证）

1. **获取认证 Token**
   - 通过浏览器登录后，从 cookies 或 localStorage 获取 session token

2. **第一次 API 调用（缓存未命中）**
   ```bash
   curl -X POST http://localhost:3000/api/media/submit \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "url": "https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc",
       "outputType": "video"
     }'
   ```
   - 查看服务器日志：`[Cache Miss] Fetching from RapidAPI for ...`
   - 记录返回的 `taskId`

3. **检查任务状态**
   ```bash
   curl "http://localhost:3000/api/media/status?id={taskId}"
   ```
   - 等待任务完成（status: 'extracted'）

4. **第二次 API 调用（缓存命中）**
   ```bash
   curl -X POST http://localhost:3000/api/media/submit \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "url": "https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc",
       "outputType": "video"
     }'
   ```
   - 查看服务器日志：`[Cache Hit] Skipping API call for ...`
   - 任务应该快速完成

---

## 📊 预期测试结果

### 第一次提交（缓存未命中）

**服务器日志**：
```
[Cache Miss] Fetching from RapidAPI for https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc
```

**任务流程**：
1. 创建任务 → status: 'pending'
2. 调用 RapidAPI → 获取视频数据
3. 保存缓存 → `video_cache` 表新增 1 条记录
4. 处理视频 URL → 上传到存储（如果配置）
5. 完成任务 → status: 'extracted'

**响应时间**：2-5 秒（取决于 API 响应速度）

---

### 第二次提交（缓存命中）

**服务器日志**：
```
[Cache Hit] Skipping API call for https://www.tiktok.com/@Dasher/video/7574110549382909201?is_from_webapp=1&sender_device=pc
Using cached YouTube video URL
```

**任务流程**：
1. 创建任务 → status: 'pending'
2. ✅ **查找缓存** → 找到有效缓存条目
3. ✅ **跳过 API 调用** → 直接使用缓存的 `downloadUrl`
4. 处理视频 URL → 使用缓存的 URL
5. 完成任务 → status: 'extracted'

**响应时间**：<100ms（几乎瞬间完成）

---

### 验证点

✅ **API 调用次数**：
- 第一次：1 次 API 调用
- 第二次：0 次 API 调用（完全跳过）

✅ **缓存数据**：
- `video_cache` 表中有 1 条记录
- `expires_at` 为 12 小时后
- `platform` 为 'tiktok'

✅ **任务数据**：
- 第二次任务中，metadata 字段（title, author 等）为 NULL
- `videoUrlInternal` 字段正确设置（使用缓存的 URL）
- 任务状态正确更新为 'extracted'

---

## 🔍 验证命令

### 1. 查看缓存表数据

```bash
npx tsx -e "
import { db } from './src/core/db';
import { videoCache } from './src/config/db/schema';
const data = await db().select().from(videoCache);
console.log('Cache entries:', data.length);
data.forEach(d => {
  console.log('ID:', d.id.substring(0, 32) + '...');
  console.log('Platform:', d.platform);
  console.log('Original URL:', d.originalUrl);
  console.log('Download URL:', d.downloadUrl.substring(0, 50) + '...');
  console.log('Expires at:', d.expiresAt);
  console.log('---');
});
"
```

### 2. 查看任务数据

```bash
npx tsx -e "
import { db } from './src/core/db';
import { mediaTasks } from './src/config/db/schema';
import { eq, desc } from 'drizzle-orm';
const tasks = await db()
  .select()
  .from(mediaTasks)
  .where(eq(mediaTasks.outputType, 'video'))
  .orderBy(desc(mediaTasks.createdAt))
  .limit(5);
tasks.forEach(t => {
  console.log('Task ID:', t.id);
  console.log('Video URL:', t.videoUrl);
  console.log('Title:', t.title || '(NULL)');
  console.log('Platform:', t.platform);
  console.log('Status:', t.status);
  console.log('Created:', t.createdAt);
  console.log('---');
});
"
```

---

## ⚠️ 注意事项

### 1. Metadata 字段为 NULL

缓存命中时，以下字段将为 NULL：
- `title`
- `author`
- `thumbnailUrl`
- `likes`, `views`, `shares`
- `duration`
- `publishedAt`

**前端需要处理**：显示占位符或跳过显示这些字段。

### 2. 缓存过期

- **默认过期时间**：12 小时
- **过期后**：缓存自动失效，下次请求会重新调用 API
- **手动清理**：可以运行清理脚本删除过期缓存

### 3. URL 参数

即使 URL 中包含不同的查询参数（如 `?is_from_webapp=1&sender_device=pc`），标准化后的 URL 相同，因此会命中同一个缓存。

---

## 📈 性能对比

| 指标 | 缓存未命中 | 缓存命中 | 提升 |
|------|-----------|---------|------|
| API 调用 | 1 次 | 0 次 | **100%** |
| 响应时间 | 2-5 秒 | <100ms | **95%+** |
| 成本 | 完整 API 费用 | 0 费用 | **100%** |

---

**测试日期**：2024-12-19  
**测试状态**：✅ 核心功能已验证，等待完整端到端测试

