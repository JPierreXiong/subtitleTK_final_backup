-- ============================================
-- 添加 Watchdog 索引（软约束版）
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 创建 watchdog 索引（使用 updated_at，不新增字段）
-- 2. 优化超时任务查询性能
-- 
-- ⚠️ 注意：不新增字段，只添加索引
-- ============================================

-- 创建 watchdog 索引（用于快速查询超时任务）
-- 使用 updated_at 代替 started_at（软约束）
CREATE INDEX IF NOT EXISTS "idx_media_task_watchdog" 
ON "media_tasks" ("status", "updated_at")
WHERE "status" = 'processing';

-- 验证索引
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'media_tasks'
  AND indexname = 'idx_media_task_watchdog';

-- ============================================
-- 注意事项：
-- 1. 不新增任何字段，只添加索引
-- 2. Watchdog 使用 updated_at 判断超时
-- 3. timeout 是逻辑状态，存储为 'failed'
-- 4. 通过 error_message 区分 timeout 和其他失败
-- ============================================

