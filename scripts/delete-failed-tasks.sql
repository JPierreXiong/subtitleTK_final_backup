-- ============================================
-- 删除失败的媒体任务记录
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- ⚠️ 警告：此操作不可逆，请谨慎使用
-- ============================================

-- 第一步：查看要删除的记录数量
SELECT 
  COUNT(*) as failed_tasks_count,
  'Failed tasks to be deleted' as message
FROM "media_tasks"
WHERE status = 'failed';

-- 第二步：查看要删除的记录详情（可选，用于确认）
SELECT 
  id,
  user_id,
  platform,
  output_type,
  status,
  error_message,
  created_at,
  updated_at
FROM "media_tasks"
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;

-- 第三步：删除失败的记录
-- ⚠️ 注意：此操作会永久删除数据，请确保已备份
DELETE FROM "media_tasks"
WHERE status = 'failed';

-- 第四步：验证删除结果
SELECT 
  COUNT(*) as remaining_failed_tasks,
  'Remaining failed tasks' as message
FROM "media_tasks"
WHERE status = 'failed';

-- ============================================
-- 可选：只删除特定错误类型的记录
-- ============================================

-- 删除超时相关的失败记录
-- DELETE FROM "media_tasks"
-- WHERE status = 'failed' 
--   AND (error_message LIKE '%Timeout%' 
--     OR error_message LIKE '%timeout%'
--     OR error_message LIKE '%Task Cleared%'
--     OR error_message LIKE '%System Reset%');

-- 删除 API 失败相关的记录
-- DELETE FROM "media_tasks"
-- WHERE status = 'failed' 
--   AND (error_message LIKE '%Failed to fetch%' 
--     OR error_message LIKE '%API%');

-- ============================================
-- 注意事项：
-- 1. 删除前建议先备份数据
-- 2. 如果任务有关联的 credit 记录，删除任务不会影响 credit 表
-- 3. 已退款的 credit 记录状态为 'deleted'，不会被删除
-- ============================================


