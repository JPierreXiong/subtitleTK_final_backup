-- ============================================
-- 为用户充值 200 积分（仅充值，不设置管理员）
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 为 xiongjp_fr@163.com 充值 200 积分
-- 2. 为 xiongjp_fr@hotmail.com 充值 200 积分
-- 3. 显示充值后的积分余额
-- ============================================

-- 第一步：查找用户 ID 并充值
DO $$
DECLARE
  user1_id TEXT;
  user1_email TEXT := 'xiongjp_fr@163.com';
  user2_id TEXT;
  user2_email TEXT := 'xiongjp_fr@hotmail.com';
  credits_amount INTEGER := 200;
  transaction_no TEXT;
  credit_id TEXT;
BEGIN
  -- 查找第一个用户
  SELECT id INTO user1_id
  FROM "user"
  WHERE email = user1_email;
  
  IF user1_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user1_email;
  END IF;
  
  RAISE NOTICE 'Found user 1: % (ID: %)', user1_email, user1_id;
  
  -- 为第一个用户充值 200 积分
  credit_id := gen_random_uuid()::TEXT;
  transaction_no := 'GIFT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM999999999999999999') || '-' || SUBSTRING(credit_id, 1, 8);
  
  INSERT INTO "credit" (
    id,
    user_id,
    user_email,
    transaction_no,
    transaction_type,
    transaction_scene,
    credits,
    remaining_credits,
    status,
    description,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    credit_id,
    user1_id,
    user1_email,
    transaction_no,
    'grant',
    'gift',
    credits_amount,
    credits_amount,
    'active',
    'Test credit grant - 200 credits',
    NULL, -- Never expires
    NOW(),
    NOW()
  );
  
  RAISE NOTICE '✅ Granted % credits to user 1 (%)', credits_amount, user1_email;
  
  -- 查找第二个用户
  SELECT id INTO user2_id
  FROM "user"
  WHERE email = user2_email;
  
  IF user2_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user2_email;
  END IF;
  
  RAISE NOTICE 'Found user 2: % (ID: %)', user2_email, user2_id;
  
  -- 为第二个用户充值 200 积分
  credit_id := gen_random_uuid()::TEXT;
  transaction_no := 'GIFT-' || TO_CHAR(EXTRACT(EPOCH FROM NOW())::BIGINT, 'FM999999999999999999') || '-' || SUBSTRING(credit_id, 1, 8);
  
  INSERT INTO "credit" (
    id,
    user_id,
    user_email,
    transaction_no,
    transaction_type,
    transaction_scene,
    credits,
    remaining_credits,
    status,
    description,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    credit_id,
    user2_id,
    user2_email,
    transaction_no,
    'grant',
    'gift',
    credits_amount,
    credits_amount,
    'active',
    'Test credit grant - 200 credits',
    NULL, -- Never expires
    NOW(),
    NOW()
  );
  
  RAISE NOTICE '✅ Granted % credits to user 2 (%)', credits_amount, user2_email;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Credit grant completed successfully!';
  RAISE NOTICE '========================================';
  
END $$;

-- 第二步：显示充值后的积分余额
SELECT 
  u.email,
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
  COUNT(CASE WHEN c.transaction_type = 'grant' AND c.status = 'active' THEN 1 END) as active_grant_records
FROM "user" u
LEFT JOIN "credit" c ON c.user_id = u.id
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
GROUP BY u.email, u.id, u.name
ORDER BY u.email;

-- ============================================
-- 说明：
-- total_credits: 用户当前可用积分总数
-- active_grant_records: 活跃的积分授予记录数
-- ============================================




