# 数据库Schema修改方案（待批准）

## 📋 修改内容总结

### 需要新增的字段（5个）

1. `subtitle_raw` (TEXT) - 原始母语字幕文本
2. `subtitle_translated` (TEXT) - 翻译后字幕文本  
3. `video_url_internal` (VARCHAR(500)) - R2存储的Object Key（不是完整URL）
4. `expires_at` (TIMESTAMP) - 24小时过期时间（仅视频任务需要）
5. `output_type` (TEXT) - 输出类型：'subtitle' 或 'video'（新增，用于记录用户选择）

### 需要新增的索引（1个）

- `idx_media_task_expires` - 用于查询过期视频

### 需要更新的状态值

状态流转：`pending` → `processing` → `extracted` → `translating` → `completed` / `failed`

---

## 🔧 具体修改代码

### 修改位置
`src/config/db/schema.ts` - `mediaTasks` 表定义（第543-583行）

### 修改内容

```typescript
export const mediaTasks = pgTable(
  'media_tasks',
  {
    // ========== 现有字段（保持不变）==========
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(), // 'youtube' | 'tiktok'
    videoUrl: text('video_url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    title: text('title'),
    author: text('author'),
    duration: integer('duration'), // duration in seconds
    likes: integer('likes'),
    views: integer('views'),
    shares: integer('shares'),
    publishedAt: timestamp('published_at'),
    sourceLang: text('source_lang'),
    targetLang: text('target_lang'), // ✅ 复用现有字段，用于存储用户选择的目标语言
    status: text('status').notNull().default('pending'), 
    // 状态值: 'pending' | 'processing' | 'extracted' | 'translating' | 'completed' | 'failed'
    progress: integer('progress').notNull().default(0), // 0-100
    srtUrl: text('srt_url'), // native language SRT file URL
    translatedSrtUrl: text('translated_srt_url'), // translated SRT file URL
    resultVideoUrl: text('result_video_url'), // TikTok video download URL (only for TikTok)
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    
    // ========== 新增字段（5个）==========
    // 字幕文本内容存储
    subtitleRaw: text('subtitle_raw'), // 原始母语字幕文本（.srt格式）
    subtitleTranslated: text('subtitle_translated'), // 翻译后字幕文本（.srt格式）
    
    // 视频存储相关
    videoUrlInternal: text('video_url_internal'), // R2存储的Object Key（如：videos/tiktok_12345.mp4）
    expiresAt: timestamp('expires_at'), // 24小时过期时间（仅视频任务需要，可为NULL）
    
    // 输出类型（用户选择）
    outputType: text('output_type'), // 'subtitle' | 'video'
  },
  (table) => [
    // ========== 现有索引（保持不变）==========
    index('idx_media_task_user_status').on(table.userId, table.status),
    index('idx_media_task_platform_status').on(table.platform, table.status),
    
    // ========== 新增索引（1个）==========
    index('idx_media_task_expires').on(table.expiresAt), // 用于查询过期视频
  ]
);
```

---

## 📝 SQL迁移脚本

```sql
-- 添加字幕文本字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS subtitle_raw TEXT,
ADD COLUMN IF NOT EXISTS subtitle_translated TEXT;

-- 添加视频存储字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS video_url_internal VARCHAR(500),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- 添加输出类型字段
ALTER TABLE media_tasks 
ADD COLUMN IF NOT EXISTS output_type TEXT;

-- 添加索引（用于查询过期视频）
CREATE INDEX IF NOT EXISTS idx_media_task_expires 
ON media_tasks(expires_at) 
WHERE expires_at IS NOT NULL;
```

---

## ✅ 修改说明

### 1. 字段说明

- **`subtitle_raw`**: TEXT类型，不限制长度，存储完整的SRT格式文本
- **`subtitle_translated`**: TEXT类型，不限制长度，存储翻译后的SRT格式文本
- **`video_url_internal`**: VARCHAR(500)，存储R2的Object Key（如：`videos/tiktok_12345.mp4`），不是完整URL
- **`expires_at`**: TIMESTAMP，可为NULL（仅视频任务需要）
- **`output_type`**: TEXT，值为 `'subtitle'` 或 `'video'`，记录用户选择

### 2. 状态值更新

状态流转逻辑：
- `pending` - 初始状态，任务已创建
- `processing` - 第一阶段处理中（提取元数据+字幕+可选视频下载）
- `extracted` - 第一阶段完成，等待用户选择翻译
- `translating` - 第二阶段处理中（Gemini翻译）
- `completed` - 全部完成
- `failed` - 任务失败

### 3. 索引说明

- `idx_media_task_expires`: 用于定时任务查询过期视频，使用部分索引（WHERE expires_at IS NOT NULL）提高效率

---

## ⚠️ 注意事项

1. **向后兼容**: 所有新增字段都是可选的（nullable），不会影响现有数据
2. **字段长度**: `subtitle_raw` 和 `subtitle_translated` 使用TEXT类型，不限制长度
3. **默认值**: `expires_at` 在非视频任务时为NULL
4. **复用字段**: `target_lang` 字段复用，不新增 `target_language`

---

## 🚀 执行步骤

1. ✅ 修改 `src/config/db/schema.ts`
2. ✅ 运行 `npx drizzle-kit push` 同步到Neon数据库
3. ✅ 验证新字段已创建
4. ✅ 更新TypeScript类型定义（自动生成）

---

## ❓ 待确认问题

1. **`output_type` 字段**: 是否需要添加默认值约束（CHECK约束）限制只能为 'subtitle' 或 'video'？
2. **`video_url_internal` 长度**: VARCHAR(500) 是否足够？R2的Object Key通常不会超过这个长度。

---

**请批准此修改方案，批准后我将开始实施。**


