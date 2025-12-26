# 缓存方案对比分析

## 📊 两个方案的核心差异

### 方案 A：用户提供的方案（完全跳过 API 调用）

**核心逻辑**：
```typescript
// 缓存命中时
if (cached) {
  // ✅ 完全跳过 API 调用
  // 直接创建任务，使用缓存的 downloadUrl
  const taskId = await createMediaTaskWithCache({
    userId: user.id,
    videoUrlInternal: `original:${cached.downloadUrl}`,
    platform: cached.platform,
    // ❌ 没有 title, author, thumbnailUrl 等 metadata
  });
  return respData({ taskId, cached: true });
}
```

**特点**：
- ✅ **最大节省**：完全跳过 API 调用（100% 节省）
- ✅ **最快响应**：无需等待 API 响应时间（2-5秒 → <100ms）
- ❌ **缺失 metadata**：title, author, thumbnailUrl, duration 等字段为 NULL
- ❌ **用户体验**：前端可能显示"未知标题"或空白

---

### 方案 B：我实施的方案（部分跳过 API 调用）

**核心逻辑**：
```typescript
// 缓存命中时
if (cached) {
  cachedVideoUrl = cached.downloadUrl;
}

// ⚠️ 仍然调用 API 获取 metadata
const mediaData = await fetchMediaFromRapidAPI(url, outputType);

// 使用缓存的 URL 覆盖 API 返回的
if (cachedVideoUrl) {
  mediaData.videoUrl = cachedVideoUrl;
}
```

**特点**：
- ⚠️ **部分节省**：仍调用 API（但跳过视频下载 URL 的获取，如果 API 支持分离）
- ⚠️ **响应时间**：仍需等待 API 响应（2-5秒）
- ✅ **完整 metadata**：title, author, thumbnailUrl 等字段完整
- ✅ **用户体验**：前端正常显示视频信息

---

## 🔍 关键差异总结

| 维度 | 方案 A（用户方案） | 方案 B（我的方案） |
|------|------------------|------------------|
| **API 调用** | ✅ 完全跳过 | ⚠️ 仍然调用（获取 metadata） |
| **成本节省** | ✅ 100% 节省 | ⚠️ 0% 节省（如果 API 不分离） |
| **响应速度** | ✅ 极快（<100ms） | ❌ 正常（2-5秒） |
| **Metadata** | ❌ 缺失（NULL） | ✅ 完整 |
| **前端显示** | ❌ 可能空白 | ✅ 正常显示 |
| **实现复杂度** | ⚠️ 中等（需要处理 NULL） | ✅ 简单（最小改动） |

---

## 💡 深入分析

### 问题 1：RapidAPI 是否支持分离调用？

查看代码，`fetchMediaFromRapidAPI` 根据 `outputType` 调用不同的 API：
- `outputType === 'video'` → `fetchYouTubeVideo()` 或 `fetchTikTokVideo()`
- `outputType === 'subtitle'` → `fetchYouTubeMedia()` 或 `fetchTikTokMedia()`

**关键发现**：
- 视频下载 API 可能**同时返回** metadata 和 videoUrl
- 如果 API 设计是"一体"的（必须调用才能获取 metadata），那么：
  - **方案 A 的优势更明显**：既然 API 调用无法避免 metadata 的获取，那完全跳过可以节省 100% 成本
  - **方案 B 没有实际优势**：仍然需要调用 API，只是用缓存的 URL 覆盖

### 问题 2：前端是否需要 metadata？

查看 `media_task` schema：
- `title`, `author`, `thumbnailUrl` 等字段是 **可选的**（没有 `notNull()`）
- 前端**可能**可以处理 NULL 值，显示"未知标题"或占位符

**结论**：
- 如果前端可以优雅处理 NULL metadata，**方案 A 更优**
- 如果前端依赖 metadata，**方案 B 更优**

---

## 🎯 最佳方案建议

### 推荐：**混合方案（方案 A + 可选 metadata 缓存）**

结合两个方案的优点：

```typescript
// Step 1: 扩展 video_cache 表，增加 metadata 字段（可选）
export const videoCache = pgTable('video_cache', {
  id: text('id').primaryKey(),
  originalUrl: text('original_url').notNull(),
  downloadUrl: text('download_url').notNull(),
  platform: text('platform').notNull(),
  
  // ✅ 新增：缓存 metadata（可选字段）
  title: text('title'),
  author: text('author'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'),
  // ... 其他 metadata
  
  expiresAt: timestamp('expires_at').notNull(),
  // ...
});

// Step 2: 缓存命中时，完全跳过 API 调用
if (cached) {
  // ✅ 使用缓存的 metadata 和 downloadUrl
  const mediaData = {
    platform: cached.platform,
    videoUrl: cached.downloadUrl,
    title: cached.title || 'Unknown Title',
    author: cached.author || null,
    thumbnailUrl: cached.thumbnailUrl || null,
    // ...
  };
  
  // 直接使用缓存数据，跳过 API 调用
  // 更新任务记录...
}
```

**优势**：
- ✅ **100% 节省 API 调用**（缓存命中时）
- ✅ **完整 metadata**（从缓存获取）
- ✅ **极快响应速度**（<100ms）
- ✅ **良好用户体验**（前端正常显示）

**实施复杂度**：
- ⚠️ 需要扩展 `video_cache` 表（增加 metadata 字段）
- ⚠️ 需要修改 `setVideoCache` 保存 metadata
- ⚠️ 需要修改 `findValidVideoCache` 返回 metadata

---

## 📋 最终建议

### 短期方案：**采用方案 A（用户的方案）**

**理由**：
1. ✅ **最大成本节省**：完全跳过 API 调用
2. ✅ **最快实施**：只需修改逻辑，无需扩展表结构
3. ✅ **可接受 trade-off**：metadata 缺失可以通过前端占位符处理

**实施步骤**：
1. 修改 `processMediaTask`：缓存命中时完全跳过 API 调用
2. 处理 NULL metadata：前端显示占位符或"未知标题"
3. 监控效果：观察 API 调用减少情况

### 长期方案：**采用混合方案（扩展缓存表）**

**理由**：
1. ✅ **最佳用户体验**：完整 metadata + 极快响应
2. ✅ **最大成本节省**：100% 跳过 API 调用
3. ✅ **可持续优化**：为未来扩展打下基础

**实施步骤**：
1. 扩展 `video_cache` 表（增加 metadata 字段）
2. 修改 `setVideoCache` 保存 metadata
3. 修改 `findValidVideoCache` 返回完整数据
4. 修改 `processMediaTask` 使用缓存数据

---

## 🔄 代码修改建议

### 如果要采用方案 A（用户的方案），需要修改：

```typescript
// src/app/api/media/submit/route.ts

async function processMediaTask(...) {
  // Step 1: Check cache
  let cachedVideoUrl: string | null = null;
  let cachedPlatform: 'youtube' | 'tiktok' | null = null;
  
  if (outputType === 'video') {
    const fingerprint = generateVideoFingerprint(url);
    const cached = await findValidVideoCache(fingerprint);
    
    if (cached) {
      console.log(`[Cache Hit] Skipping API call for ${url}`);
      cachedVideoUrl = cached.downloadUrl;
      cachedPlatform = cached.platform;
      
      // ✅ 直接使用缓存数据，跳过 API 调用
      // 更新任务记录（metadata 字段为 NULL）
      await updateMediaTaskById(taskId, {
        status: 'processing',
        progress: 30,
        platform: cachedPlatform,
        // title, author 等字段不设置（保持 NULL）
      });
      
      // 处理 videoUrlInternal...
      if (cachedVideoUrl) {
        videoUrlInternal = `original:${cachedVideoUrl}`;
        expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        
        await updateMediaTaskById(taskId, {
          status: 'extracted',
          progress: 100,
          videoUrlInternal,
          expiresAt,
        });
      }
      
      return; // ✅ 提前返回，跳过 API 调用
    }
  }
  
  // ❌ 缓存未命中：正常 API 调用流程
  const mediaData = await fetchMediaFromRapidAPI(url, outputType);
  
  // 缓存结果...
}
```

---

## ✅ 结论

**当前实施的方案 B 不够理想**，因为：
- ⚠️ 仍然调用 API，没有真正节省成本
- ⚠️ 只是用缓存的 URL 覆盖，没有实际意义

**推荐采用方案 A（用户的方案）**：
- ✅ 真正节省 API 调用成本
- ✅ 响应速度大幅提升
- ✅ 实施简单，风险低

**长期可以演进到混合方案**，获得最佳体验和最大节省。

