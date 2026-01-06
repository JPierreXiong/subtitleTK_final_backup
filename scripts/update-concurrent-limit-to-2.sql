-- ============================================
-- 更新并发限制从 1 到 2
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 更新所有 subscription 记录的并发限制（如果当前是 1，则改为 2）
-- 2. 显示更新结果
-- ============================================

-- 第一步：查看当前并发限制为 1 的订阅数量
SELECT 
  COUNT(*) as subscriptions_with_limit_1,
  'Subscriptions with concurrent_limit = 1' as description
FROM "subscription"
WHERE concurrent_limit = 1 AND status = 'active';

-- 第二步：更新所有活跃订阅的并发限制（从 1 改为 2）
UPDATE "subscription"
SET 
  concurrent_limit = 2,
  updated_at = NOW()
WHERE concurrent_limit = 1 
  AND status = 'active';

-- 第三步：验证更新结果
SELECT 
  concurrent_limit,
  COUNT(*) as count,
  'Distribution of concurrent_limit values' as description
FROM "subscription"
WHERE status = 'active'
GROUP BY concurrent_limit
ORDER BY concurrent_limit;

-- 第四步：显示更新后的订阅详情（前 10 条）
SELECT 
  id,
  subscription_no,
  user_email,
  plan_name,
  concurrent_limit,
  status,
  updated_at
FROM "subscription"
WHERE status = 'active'
ORDER BY updated_at DESC
LIMIT 10;

-- ============================================
-- 注意事项：
-- 1. 只更新 concurrent_limit = 1 的活跃订阅
-- 2. null 值（无限制）不会被修改
-- 3. 新创建的订阅将使用默认值 2（schema 已更新）
-- ============================================

