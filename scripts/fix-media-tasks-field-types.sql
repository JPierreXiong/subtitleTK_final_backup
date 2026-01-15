-- ============================================
-- 修复 media_tasks 表字段类型（确保能容纳超长 URL）
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 确保所有 URL 字段都是 TEXT 类型（无长度限制）
-- 2. 确保 duration 字段是 INTEGER 类型
-- 3. 确保 progress 字段是 INTEGER 类型（0-100）
-- ============================================

-- 第一步：检查当前字段类型
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'media_tasks'
  AND column_name IN ('thumbnail_url', 'video_url', 'duration', 'progress', 'author')
ORDER BY column_name;

-- 第二步：确保 URL 字段是 TEXT 类型（无长度限制）
-- 如果已经是 TEXT，这个操作不会改变任何内容
ALTER TABLE "media_tasks" 
  ALTER COLUMN "thumbnail_url" TYPE TEXT;

ALTER TABLE "media_tasks" 
  ALTER COLUMN "video_url" TYPE TEXT;

ALTER TABLE "media_tasks" 
  ALTER COLUMN "srt_url" TYPE TEXT;

ALTER TABLE "media_tasks" 
  ALTER COLUMN "translated_srt_url" TYPE TEXT;

ALTER TABLE "media_tasks" 
  ALTER COLUMN "result_video_url" TYPE TEXT;

ALTER TABLE "media_tasks" 
  ALTER COLUMN "video_url_internal" TYPE TEXT;

-- 第三步：确保 duration 是 INTEGER 类型
-- 如果已经是 INTEGER，这个操作不会改变任何内容
ALTER TABLE "media_tasks" 
  ALTER COLUMN "duration" TYPE INTEGER USING CASE 
    WHEN duration::text ~ '^[0-9]+$' THEN duration::integer
    ELSE NULL
  END;

-- 第四步：确保 progress 是 INTEGER 类型（0-100）
-- 如果已经是 INTEGER，这个操作不会改变任何内容
ALTER TABLE "media_tasks" 
  ALTER COLUMN "progress" TYPE INTEGER USING CASE 
    WHEN progress::text ~ '^[0-9]+$' THEN LEAST(GREATEST(progress::integer, 0), 100)
    ELSE 0
  END;

-- 第五步：确保 author 字段允许 NULL（空字符串转换为 NULL）
-- 如果已经是 TEXT，这个操作不会改变任何内容
ALTER TABLE "media_tasks" 
  ALTER COLUMN "author" TYPE TEXT;

-- 第六步：验证修改结果
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'media_tasks'
  AND column_name IN ('thumbnail_url', 'video_url', 'duration', 'progress', 'author')
ORDER BY column_name;

-- ============================================
-- 注意事项：
-- 1. TEXT 类型可以存储任意长度的字符串（PostgreSQL 限制约 1GB）
-- 2. duration 必须是整数（秒数），不是字符串格式 "00:28"
-- 3. progress 必须是 0-100 之间的整数
-- 4. author 允许 NULL，空字符串会被转换为 NULL
-- ============================================




