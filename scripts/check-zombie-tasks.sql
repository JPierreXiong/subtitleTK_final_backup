-- ============================================
-- 检查"僵尸任务" SQL 查询
-- ============================================
-- 用途：检查迁移后是否有异常状态的任务
-- 使用方法：在 Supabase SQL Editor 中运行
-- ============================================

-- 1. 检查失败任务但未退款的（僵尸任务）
SELECT 
    mt.id,
    mt.user_id,
    mt.platform,
    mt.status,
    mt.error_message,
    mt.credit_id,
    mt.created_at,
    mt.updated_at,
    CASE 
        WHEN mt.credit_id IS NULL THEN '无积分记录'
        WHEN c.status = 'active' THEN '⚠️ 未退款'
        WHEN c.status = 'deleted' THEN '✓ 已退款'
        ELSE '未知状态'
    END as refund_status
FROM media_tasks mt
LEFT JOIN credit c ON c.id = mt.credit_id
WHERE mt.status = 'failed'
ORDER BY mt.created_at DESC;

-- 2. 检查长时间处于 processing 状态的任务（可能卡住的任务）
SELECT 
    id,
    user_id,
    platform,
    status,
    progress,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_since_update,
    error_message
FROM media_tasks
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '30 minutes'  -- 超过30分钟未更新
ORDER BY updated_at ASC;

-- 3. 检查有 credit_id 但积分记录不存在的任务（数据不一致）
SELECT 
    mt.id,
    mt.user_id,
    mt.status,
    mt.credit_id,
    mt.created_at
FROM media_tasks mt
WHERE mt.credit_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM credit c WHERE c.id = mt.credit_id
  );

-- 4. 统计各状态任务数量
SELECT 
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN credit_id IS NOT NULL THEN 1 END) as with_credit,
    COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_error
FROM media_tasks
GROUP BY status
ORDER BY count DESC;

-- 5. 检查失败任务按平台分组
SELECT 
    platform,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN credit_id IS NOT NULL THEN 1 END) as with_credit_id
FROM media_tasks
WHERE status = 'failed'
GROUP BY platform, status
ORDER BY count DESC;

-- 6. 检查最近的失败任务（最近24小时）
SELECT 
    mt.id,
    mt.platform,
    mt.status,
    LEFT(mt.error_message, 100) as error_preview,
    mt.credit_id,
    mt.created_at,
    u.email as user_email
FROM media_tasks mt
LEFT JOIN "user" u ON u.id = mt.user_id
WHERE mt.status = 'failed'
  AND mt.created_at > NOW() - INTERVAL '24 hours'
ORDER BY mt.created_at DESC
LIMIT 50;





