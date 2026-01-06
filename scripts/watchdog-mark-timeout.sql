-- ============================================
-- Watchdog: 标记超时任务（软约束版）
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 或通过 cron job 定期执行
-- 
-- 此脚本将：
-- 1. 查找所有超时的 processing 任务
-- 2. 标记为 failed（timeout 是逻辑状态）
-- 3. 触发自动退款
-- ============================================

-- Watchdog: 标记超时任务
-- 使用 updated_at 代替 started_at（不新增字段）
UPDATE "media_tasks"
SET 
  status = 'failed',
  error_message = 'Task timeout (watchdog): Exceeded 90 seconds',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '90 seconds';

-- 显示标记结果
SELECT 
  COUNT(*) as timeout_tasks_count,
  'Tasks marked as timeout (stored as failed)' as message
FROM "media_tasks"
WHERE status = 'failed' 
  AND error_message LIKE '%timeout (watchdog)%'
  AND updated_at > NOW() - INTERVAL '1 minute';

-- ============================================
-- 注意事项：
-- 1. timeout 是逻辑状态，实际存储为 'failed'
-- 2. 通过 error_message 区分 timeout 和其他失败
-- 3. 标记为 failed 会触发自动退款（在 updateMediaTaskById 中）
-- 4. 建议通过 cron job 每 30 秒执行一次
-- ============================================

