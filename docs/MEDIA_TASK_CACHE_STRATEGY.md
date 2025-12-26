# 媒体任务缓存策略设计方案

## 📋 问题分析

### 当前问题
- **重复 API 调用**：不同用户请求相同视频时，每次都调用 RapidAPI
- **资源浪费**：相同视频的元数据（title, author, subtitle）被重复获取
- **成本增加**：RapidAPI 按调用次数收费，重复调用增加成本
- **响应时间**：即使数据已存在，仍需等待 API 响应

### 优化目标
- ✅ 减少 RapidAPI 调用次数（节省成本）
- ✅ 提升响应速度（复用已有数据）
- ✅ 保持数据一致性
- ✅ 不破坏 ShipAny 架构结构

---

## 🏗️ 缓存策略框架

### 核心思路：**"视频唯一标识 + 成功任务查询"**

通过标准化 URL，提取视频唯一标识符，查询是否存在相同视频的成功任务，复用其元数据和字幕内容。

---

## 🔍 方案 1：数据库级缓存（推荐）

### 设计原理

利用现有的 `media_tasks` 表，通过查询已有成功任务来复用数据，**无需新建缓存表**。

### 实施步骤

#### Step 1: URL 标准化工具函数

**位置**：`src/shared/utils/video-url-normalizer.ts` (新建)

```typescript
/**
 * 标准化视频 URL，提取唯一标识符
 * 用于缓存查找和数据去重
 */

/**
 * 标准化 YouTube URL
 * 将各种格式统一为: https://www.youtube.com/watch?v=VIDEO_ID
 */
export function normalizeYouTubeUrl(url: string): string {
  // 使用现有的 formatYouTubeUrl 逻辑
  if (url.includes('/shorts/')) {
    const shortsMatch = url.match(/(?:www\.|m\.)?youtube\.com\/shorts\/([^&\n?#\/]+)/);
    if (shortsMatch && shortsMatch[1]) {
      return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    }
  }
  // 处理 youtu.be 格式
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^&\n?#]+)/);
    if (match && match[1]) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return url;
}

/**
 * 标准化 TikTok URL
 * TikTok URL 格式多样，保留完整 URL 作为标识（因为 videoId 可能相同但内容不同）
 */
export function normalizeTikTokUrl(url: string): string {
  // 简化：去除追踪参数，保留核心路径
  try {
    const urlObj = new URL(url);
    // 保留 hostname + pathname，去除 query 和 hash
    return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * 标准化视频 URL（自动识别平台）
 */
export function normalizeVideoUrl(url: string): string {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return normalizeYouTubeUrl(url);
  }
  if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    return normalizeTikTokUrl(url);
  }
  return url;
}
```

#### Step 2: 缓存查找服务

**位置**：`src/shared/services/media/media-cache.ts` (新建)

```typescript
/**
 * 媒体任务缓存服务
 * 通过查询已有成功任务来复用数据，避免重复 API 调用
 */

import { db } from '@/core/db';
import { mediaTasks } from '@/config/db/schema';
import { eq, and, or, isNotNull, desc } from 'drizzle-orm';
import { normalizeVideoUrl } from '@/shared/utils/video-url-normalizer';

export interface CachedMediaData {
  // 元数据
  platform: 'youtube' | 'tiktok';
  title: string;
  author?: string | null;
  likes?: number | null;
  views?: number | null;
  shares?: number | null;
  duration?: number | null;
  publishedAt?: Date | null;
  thumbnailUrl?: string | null;
  sourceLang?: string | null;
  // 字幕内容
  subtitleRaw?: string | null;
  // 视频下载 URL（仅限 video outputType，且需检查过期时间）
  videoUrlInternal?: string | null;
  expiresAt?: Date | null;
}

/**
 * 查找相同视频的最近成功任务
 * @param normalizedUrl 标准化后的视频 URL
 * @param outputType 输出类型（subtitle 或 video）
 * @returns 缓存的任务数据，如果不存在则返回 null
 */
export async function findCachedMediaTask(
  normalizedUrl: string,
  outputType: 'subtitle' | 'video'
): Promise<CachedMediaData | null> {
  // 查询条件：
  // 1. 相同的标准化 URL
  // 2. 相同的 outputType
  // 3. 状态为成功（extracted 或 completed）
  // 4. 按创建时间降序，取最近的一个

  const cachedTasks = await db()
    .select({
      platform: mediaTasks.platform,
      title: mediaTasks.title,
      author: mediaTasks.author,
      likes: mediaTasks.likes,
      views: mediaTasks.views,
      shares: mediaTasks.shares,
      duration: mediaTasks.duration,
      publishedAt: mediaTasks.publishedAt,
      thumbnailUrl: mediaTasks.thumbnailUrl,
      sourceLang: mediaTasks.sourceLang,
      subtitleRaw: mediaTasks.subtitleRaw,
      videoUrlInternal: mediaTasks.videoUrlInternal,
      expiresAt: mediaTasks.expiresAt,
      createdAt: mediaTasks.createdAt,
    })
    .from(mediaTasks)
    .where(
      and(
        eq(mediaTasks.videoUrl, normalizedUrl),
        eq(mediaTasks.outputType, outputType),
        or(
          eq(mediaTasks.status, 'extracted'),
          eq(mediaTasks.status, 'completed')
        )
      )
    )
    .orderBy(desc(mediaTasks.createdAt))
    .limit(1);

  if (cachedTasks.length === 0) {
    return null;
  }

  const cached = cachedTasks[0];

  // 对于 video 类型，检查是否过期
  if (outputType === 'video' && cached.expiresAt) {
    const now = new Date();
    if (cached.expiresAt < now) {
      // 已过期，不能复用
      return null;
    }
  }

  // 检查必要字段是否存在（至少要有 title）
  if (!cached.title) {
    return null;
  }

  return {
    platform: cached.platform as 'youtube' | 'tiktok',
    title: cached.title,
    author: cached.author,
    likes: cached.likes ?? undefined,
    views: cached.views ?? undefined,
    shares: cached.shares ?? undefined,
    duration: cached.duration ?? undefined,
    publishedAt: cached.publishedAt ?? undefined,
    thumbnailUrl: cached.thumbnailUrl ?? undefined,
    sourceLang: cached.sourceLang ?? undefined,
    subtitleRaw: cached.subtitleRaw ?? undefined,
    videoUrlInternal: cached.videoUrlInternal ?? undefined,
    expiresAt: cached.expiresAt ?? undefined,
  };
}
```

#### Step 3: 集成到任务处理流程

**位置**：`src/app/api/media/submit/route.ts`

**修改点**：在 `processMediaTask` 函数中，调用 RapidAPI 之前先查询缓存

```typescript
// 在 processMediaTask 函数开头添加：

import { normalizeVideoUrl } from '@/shared/utils/video-url-normalizer';
import { findCachedMediaTask } from '@/shared/services/media/media-cache';

async function processMediaTask(
  taskId: string,
  url: string,
  outputType: 'subtitle' | 'video',
  userId: string
) {
  try {
    // Update status to processing
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 10,
    });

    // ⭐ 新增：标准化 URL 并查找缓存
    const normalizedUrl = normalizeVideoUrl(url);
    const cachedData = await findCachedMediaTask(normalizedUrl, outputType);

    let mediaData: NormalizedMediaData;

    if (cachedData) {
      // ✅ 缓存命中：复用已有数据
      console.log(`[Cache Hit] Reusing data for ${normalizedUrl}`);
      
      // 将缓存数据转换为 NormalizedMediaData 格式
      mediaData = {
        platform: cachedData.platform,
        title: cachedData.title,
        author: cachedData.author || undefined,
        likes: cachedData.likes || 0,
        views: cachedData.views || 0,
        shares: cachedData.shares || 0,
        duration: cachedData.duration,
        publishedAt: cachedData.publishedAt,
        thumbnailUrl: cachedData.thumbnailUrl || undefined,
        subtitleRaw: cachedData.subtitleRaw || undefined,
        sourceLang: cachedData.sourceLang || 'auto',
      };

      // 对于 video 类型，如果有缓存的 videoUrlInternal，直接使用
      if (outputType === 'video' && cachedData.videoUrlInternal) {
        // 跳过 RapidAPI 调用，直接使用缓存的数据
        // 但 videoUrl 需要从 videoUrlInternal 中提取（如果需要）
        // 注意：videoUrlInternal 可能包含存储前缀（如 vercel-blob:...）
        // 对于字幕任务，subtitleRaw 已经包含在 mediaData 中
      }
    } else {
      // ❌ 缓存未命中：调用 RapidAPI
      console.log(`[Cache Miss] Fetching from RapidAPI for ${normalizedUrl}`);
      mediaData = await fetchMediaFromRapidAPI(url, outputType || 'subtitle');
    }

    // 更新任务记录（使用标准化 URL）
    await updateMediaTaskById(taskId, {
      progress: 30,
      videoUrl: normalizedUrl, // ⭐ 保存标准化后的 URL
      platform: mediaData.platform,
      title: mediaData.title,
      // ... 其他字段保持不变
    });

    // 后续处理逻辑保持不变...
  } catch (error: any) {
    // 错误处理保持不变
  }
}
```

#### Step 4: 处理视频下载的存储复用

**问题**：不同用户下载相同视频时，是否应该共享存储中的视频文件？

**方案选择**：

**选项 A：存储共享（推荐，节省存储成本）**

- 相同视频的 `videoUrlInternal` 可以复用
- 多个任务指向同一个存储文件
- 优点：节省存储空间和上传时间
- 缺点：需要确保存储文件不会过早删除（通过引用计数或延长过期时间）

**选项 B：每次重新上传（简单，但浪费存储）**

- 每个任务独立上传视频到存储
- 优点：逻辑简单，文件独立
- 缺点：浪费存储空间

**推荐实施（选项 A）**：

```typescript
// 在 processMediaTask 中，处理视频下载时：

if (outputType === 'video' && mediaData.videoUrl) {
  if (cachedData && cachedData.videoUrlInternal && cachedData.expiresAt) {
    // ✅ 缓存命中：复用存储中的视频文件
    const now = new Date();
    if (cachedData.expiresAt > now) {
      // 存储文件未过期，直接复用
      videoUrlInternal = cachedData.videoUrlInternal;
      expiresAt = cachedData.expiresAt;
      
      await updateMediaTaskById(taskId, {
        progress: 70,
        videoUrlInternal: videoUrlInternal,
        expiresAt: expiresAt,
      });
      
      // 跳过上传步骤，直接进入完成状态
      console.log(`[Cache] Reusing video storage: ${videoUrlInternal}`);
    } else {
      // 存储文件已过期，需要重新获取（调用 RapidAPI 或重新上传）
      // 这种情况下 cachedData 应该返回 null，所以不会走到这里
      // 但为了健壮性，保留这个分支
    }
  } else {
    // ❌ 缓存未命中或视频 URL 不存在：正常处理（上传到存储）
    // 原有的上传逻辑...
  }
}
```

---

## 🔍 方案 2：独立缓存表（备选）

如果需要更细粒度的缓存控制（如缓存过期策略、缓存统计），可以新建一个 `media_cache` 表。

**优点**：
- 缓存与任务记录分离
- 可以设置独立的缓存过期策略
- 可以统计缓存命中率

**缺点**：
- 需要新建表和维护额外数据
- 数据同步问题（任务删除时缓存如何处理）

**不推荐**，因为方案 1 已经足够且更简单。

---

## 📊 优化效果预估

### 缓存命中率假设

- **热门视频**：如果某个视频被 10 个用户请求，缓存命中率 = 90%（第 1 次调用 API，后续 9 次复用）
- **平均场景**：假设平均每个视频被 3 个用户请求，缓存命中率 ≈ 67%

### API 调用减少

- **当前**：100 个任务 = 100 次 API 调用
- **优化后**：100 个任务（假设 67% 命中率）= 33 次 API 调用
- **节省**：67% 的 API 调用成本

### 响应时间提升

- **当前**：每次任务需要等待 RapidAPI 响应（2-5 秒）
- **优化后**：缓存命中时，直接从数据库读取（<100ms）
- **提升**：响应时间减少 95%+

---

## ⚠️ 潜在问题和解决方案

### 问题 1：URL 标准化不一致

**场景**：用户 A 使用 `youtube.com/watch?v=xxx`，用户 B 使用 `youtu.be/xxx`，如果标准化不一致，无法命中缓存。

**解决方案**：
- ✅ 使用统一的标准化函数 `normalizeVideoUrl()`
- ✅ 在保存任务时，将 `videoUrl` 字段保存为标准化后的 URL
- ✅ 查询缓存时使用相同的标准化函数

### 问题 2：视频内容更新

**场景**：YouTube 视频标题或字幕可能更新，缓存的数据可能过时。

**解决方案**：
- ✅ 可选：添加缓存过期时间（如 7 天）
- ✅ 可选：在查询缓存时，优先使用最近的任务数据（已通过 `ORDER BY createdAt DESC` 实现）
- ⚠️ 权衡：内容更新的频率通常很低，过时的风险可以接受

### 问题 3：存储文件过期

**场景**：缓存的 `videoUrlInternal` 指向的存储文件可能已过期或被删除。

**解决方案**：
- ✅ 检查 `expiresAt` 字段，如果已过期，不使用缓存
- ✅ 如果存储文件过期，触发重新获取（`cachedData` 返回 `null`）

### 问题 4：任务状态不一致

**场景**：某些任务可能处于中间状态（processing），不应该被缓存复用。

**解决方案**：
- ✅ 缓存查询时只查询成功状态（`status IN ('extracted', 'completed')`）
- ✅ 确保只有成功的任务数据才被复用

### 问题 5：TikTok URL 标准化困难

**场景**：TikTok 的短链接（vm.tiktok.com）可能对应不同的视频，标准化可能不准确。

**解决方案**：
- ⚠️ 短期：对于 TikTok，使用完整 URL（去除 query 参数）作为标识
- ✅ 长期：如果 RapidAPI 返回了 videoId，可以提取并用于缓存键

---

## 🚀 实施优先级

### Phase 1：基础缓存（字幕任务）

1. ✅ 实现 URL 标准化函数
2. ✅ 实现缓存查找服务
3. ✅ 集成到 `processMediaTask`（仅字幕任务）
4. ✅ 测试验证

**预期效果**：字幕任务的 API 调用减少 60-80%

### Phase 2：视频下载缓存

1. ✅ 处理视频存储复用逻辑
2. ✅ 处理存储过期检查
3. ✅ 测试验证

**预期效果**：视频下载任务的 API 调用减少 50-70%，存储成本节省 50%+

### Phase 3：优化和监控

1. ✅ 添加缓存命中率统计
2. ✅ 优化查询性能（添加索引）
3. ✅ 添加缓存刷新机制（可选）

---

## 📝 数据库索引建议

为了提升缓存查询性能，建议添加以下索引：

```sql
-- 复合索引：用于缓存查询
CREATE INDEX idx_media_task_url_output_status 
ON media_tasks(video_url, output_type, status) 
WHERE status IN ('extracted', 'completed');

-- 或者使用部分索引（PostgreSQL 支持）
CREATE INDEX idx_media_task_cache_lookup 
ON media_tasks(video_url, output_type, created_at DESC) 
WHERE status IN ('extracted', 'completed');
```

**注意**：需要先检查是否已有类似索引，避免重复创建。

---

## ✅ 总结

### 推荐方案

**采用方案 1（数据库级缓存）**，理由：

1. ✅ **简单高效**：利用现有表结构，无需新建表
2. ✅ **数据一致**：任务数据和缓存数据天然同步
3. ✅ **零架构改动**：完全符合 ShipAny 架构，只新增工具函数和服务
4. ✅ **实施快速**：3-5 个文件修改/新增，1-2 天可完成

### 关键实施要点

1. **URL 标准化**：确保所有相同视频使用相同的标识符
2. **缓存查询条件**：只查询成功状态的任务，检查过期时间
3. **存储复用**：对于视频下载，复用存储文件以节省成本
4. **错误处理**：缓存失败时降级到正常 API 调用流程

### 预期收益

- **API 调用成本**：减少 60-80%
- **响应时间**：缓存命中时减少 95%+
- **存储成本**：视频下载场景下减少 50%+
- **用户体验**：热门视频的响应速度大幅提升

---

## 🔄 后续优化方向（可选）

1. **缓存预热**：对于热门视频，主动缓存
2. **缓存刷新**：定期刷新过期的缓存数据
3. **分布式缓存**：如果有多实例部署，考虑 Redis 缓存层
4. **缓存统计**：添加缓存命中率监控和告警

---

**文档版本**：v1.0  
**创建日期**：2024-12-19  
**作者**：AI Assistant

