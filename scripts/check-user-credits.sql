-- ============================================
-- 检查用户积分余额
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 查询指定用户的积分余额
-- 2. 显示详细的积分记录
-- ============================================

-- 第一步：查询用户积分余额
SELECT 
  u.email,
  u.id as user_id,
  u.name,
  COALESCE(SUM(
    CASE 
      WHEN c.transaction_type = 'grant' 
        AND c.status = 'active' 
        AND (c.expires_at IS NULL OR c.expires_at > NOW())
        AND c.remaining_credits > 0
      THEN c.remaining_credits
      ELSE 0
    END
  ), 0) as total_credits,
  COUNT(CASE WHEN c.transaction_type = 'grant' AND c.status = 'active' THEN 1 END) as active_grant_records,
  COUNT(CASE WHEN c.transaction_type = 'consume' AND c.status = 'active' THEN 1 END) as active_consume_records
FROM "user" u
LEFT JOIN "credit" c ON c.user_id = u.id
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
GROUP BY u.email, u.id, u.name
ORDER BY u.email;

-- 第二步：显示详细的积分记录（最近 10 条）
SELECT 
  u.email,
  c.id as credit_id,
  c.transaction_no,
  c.transaction_type,
  c.transaction_scene,
  c.credits,
  c.remaining_credits,
  c.status,
  c.description,
  c.expires_at,
  c.created_at,
  CASE 
    WHEN c.expires_at IS NULL THEN 'Never expires'
    WHEN c.expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as validity_status
FROM "user" u
INNER JOIN "credit" c ON c.user_id = u.id
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
ORDER BY c.created_at DESC
LIMIT 20;

-- 第三步：按类型汇总积分
SELECT 
  u.email,
  c.transaction_type,
  c.status,
  COUNT(*) as record_count,
  SUM(CASE WHEN c.transaction_type = 'grant' THEN c.remaining_credits ELSE 0 END) as total_grant_credits,
  SUM(CASE WHEN c.transaction_type = 'consume' THEN ABS(c.credits) ELSE 0 END) as total_consumed_credits
FROM "user" u
INNER JOIN "credit" c ON c.user_id = u.id
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
GROUP BY u.email, c.transaction_type, c.status
ORDER BY u.email, c.transaction_type, c.status;

-- ============================================
-- 说明：
-- 1. total_credits: 用户当前可用积分（只计算 grant 类型且未过期的记录）
-- 2. active_grant_records: 活跃的积分授予记录数
-- 3. active_consume_records: 活跃的积分消费记录数
-- ============================================




