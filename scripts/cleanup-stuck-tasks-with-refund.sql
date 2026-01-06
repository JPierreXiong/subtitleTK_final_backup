-- ============================================
-- 清理卡死超时的任务（包含退款逻辑）
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 将所有 processing 状态的任务标记为 failed
-- 2. 自动退款已消耗的积分
-- 3. 清理前端轮询干扰
-- ============================================

-- 第一步：查看当前卡死的任务
SELECT 
  id,
  user_id,
  platform,
  output_type,
  status,
  credit_id,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_stuck
FROM "media_tasks"
WHERE status = 'processing'
ORDER BY created_at DESC;

-- 第二步：开始事务处理退款和清理
BEGIN;

-- 第三步：对每个有 creditId 的任务进行退款
DO $$
DECLARE
  task_record RECORD;
  credit_record RECORD;
  consumed_items JSONB;
  item JSONB;
BEGIN
  -- 遍历所有卡死的任务
  FOR task_record IN 
    SELECT id, credit_id, user_id 
    FROM "media_tasks" 
    WHERE status = 'processing' AND credit_id IS NOT NULL
  LOOP
    -- 获取积分记录
    SELECT * INTO credit_record
    FROM "credit"
    WHERE id = task_record.credit_id AND status = 'active';
    
    -- 如果找到有效的积分记录，进行退款
    IF credit_record IS NOT NULL THEN
      consumed_items := credit_record.consumed_detail::jsonb;
      
      -- 遍历 consumed_items 并退款
      FOR item IN SELECT * FROM jsonb_array_elements(consumed_items)
      LOOP
        IF (item->>'creditId') IS NOT NULL AND (item->>'creditsConsumed')::int > 0 THEN
          -- 退还积分
          UPDATE "credit"
          SET remaining_credits = remaining_credits + (item->>'creditsConsumed')::int
          WHERE id = (item->>'creditId')::uuid;
          
          RAISE NOTICE 'Refunded % credits to credit %', 
            (item->>'creditsConsumed')::int, 
            (item->>'creditId');
        END IF;
      END LOOP;
      
      -- 标记消费记录为已删除
      UPDATE "credit"
      SET status = 'deleted'
      WHERE id = task_record.credit_id;
      
      RAISE NOTICE 'Marked credit record % as deleted for task %', 
        task_record.credit_id, 
        task_record.id;
    END IF;
  END LOOP;
END $$;

-- 第四步：将所有卡死的任务标记为失败
UPDATE "media_tasks" 
SET 
  status = 'failed', 
  error_message = 'Production Timeout - Task Cleared',
  updated_at = NOW()
WHERE status = 'processing';

-- 第五步：提交事务
COMMIT;

-- 第六步：显示清理结果
SELECT 
  COUNT(*) as cleaned_tasks_count,
  'Tasks cleaned and marked as failed' as message
FROM "media_tasks"
WHERE status = 'failed' 
  AND error_message = 'Production Timeout - Task Cleared';

-- 第七步：验证退款状态
SELECT 
  c.id as credit_id,
  c.status as credit_status,
  c.remaining_credits,
  mt.id as task_id,
  mt.status as task_status,
  mt.error_message,
  mt.user_id
FROM "media_tasks" mt
LEFT JOIN "credit" c ON c.id = mt.credit_id
WHERE mt.status = 'failed' 
  AND mt.error_message = 'Production Timeout - Task Cleared'
ORDER BY mt.updated_at DESC
LIMIT 20;

-- ============================================
-- 注意事项：
-- 1. 此脚本在事务中执行，确保数据一致性
-- 2. 只有有 creditId 且 credit 状态为 'active' 的任务才会退款
-- 3. 免费试用任务（is_free_trial = true）不会消耗积分，因此不需要退款
-- 4. 退款后，credit 记录的 status 会变为 'deleted'
-- ============================================


