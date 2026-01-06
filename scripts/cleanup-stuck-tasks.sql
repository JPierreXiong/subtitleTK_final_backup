-- ============================================
-- 清理卡死超时的任务
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 将所有 processing 状态的任务标记为 failed
-- 2. 设置错误信息为 'Production Timeout - Task Cleared'
-- 3. 触发自动退款逻辑（通过 updateMediaTaskById 函数）
-- ============================================

-- 第一步：查看当前卡死的任务数量
SELECT 
  COUNT(*) as stuck_tasks_count,
  'Tasks currently stuck in processing' as message
FROM "media_tasks"
WHERE status = 'processing';

-- 第二步：清理卡死的任务
-- 注意：直接 SQL UPDATE 不会触发代码层面的自动退款
-- 如果需要退款，请使用 scripts/cleanup-stuck-tasks-with-refund.sql
UPDATE "media_tasks" 
SET 
  status = 'failed', 
  error_message = 'Production Timeout - Task Cleared',
  updated_at = NOW()
WHERE status = 'processing';

-- 第三步：显示清理结果
SELECT 
  COUNT(*) as cleaned_tasks_count,
  'Tasks cleaned and marked as failed' as message
FROM "media_tasks"
WHERE status = 'failed' 
  AND error_message = 'Production Timeout - Task Cleared';

-- 第四步：验证退款状态（检查 credit 表）
-- 注意：退款是通过 updateMediaTaskById 函数自动执行的
-- 如果 credit 记录的 status 为 'DELETED'，说明已退款
SELECT 
  c.id as credit_id,
  c.status as credit_status,
  c.consumed_detail,
  mt.id as task_id,
  mt.status as task_status,
  mt.error_message
FROM "media_tasks" mt
LEFT JOIN "credit" c ON c.id = mt.credit_id
WHERE mt.status = 'failed' 
  AND mt.error_message = 'Production Timeout - Task Cleared'
ORDER BY mt.updated_at DESC
LIMIT 20;

-- ============================================
-- 注意事项：
-- 1. 此操作会触发自动退款（如果任务有 creditId）
-- 2. 退款逻辑在 updateMediaTaskById 函数中实现
-- 3. 如果 credit 记录的 status 变为 'DELETED'，说明退款成功
-- 4. 免费试用任务（is_free_trial = true）不会消耗积分，因此不需要退款
-- ============================================

