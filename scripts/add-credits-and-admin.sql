-- ============================================
-- 为用户充值和设置管理员
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 为 xiongjp_fr@163.com 充值 200 积分并设置为管理员
-- 2. 为 xiongjp_fr@hotmail.com 充值 200 积分
-- ============================================

-- 第一步：查找用户 ID
DO $$
DECLARE
  user1_id TEXT;
  user1_email TEXT := 'xiongjp_fr@163.com';
  user2_id TEXT;
  user2_email TEXT := 'xiongjp_fr@hotmail.com';
  admin_role_id TEXT;
  credits_amount INTEGER := 200;
  transaction_no TEXT;
  credit_id TEXT;
  user_role_id TEXT;
BEGIN
  -- 查找第一个用户
  SELECT id INTO user1_id
  FROM "user"
  WHERE email = user1_email;
  
  IF user1_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user1_email;
  END IF;
  
  RAISE NOTICE 'Found user 1: % (ID: %)', user1_email, user1_id;
  
  -- 查找第二个用户
  SELECT id INTO user2_id
  FROM "user"
  WHERE email = user2_email;
  
  IF user2_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user2_email;
  END IF;
  
  RAISE NOTICE 'Found user 2: % (ID: %)', user2_email, user2_id;
  
  -- 第二步：为第一个用户充值 200 积分
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
    'Manual credit grant - 200 credits',
    NULL, -- Never expires
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Granted % credits to user 1 (%)', credits_amount, user1_email;
  
  -- 第三步：为第二个用户充值 200 积分
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
    'Manual credit grant - 200 credits',
    NULL, -- Never expires
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'Granted % credits to user 2 (%)', credits_amount, user2_email;
  
  -- 第四步：查找或创建 admin 角色
  SELECT id INTO admin_role_id
  FROM "role"
  WHERE name = 'admin' AND status = 'active';
  
  IF admin_role_id IS NULL THEN
    -- 如果 admin 角色不存在，创建它
    admin_role_id := gen_random_uuid()::TEXT;
    INSERT INTO "role" (
      id,
      name,
      title,
      description,
      status,
      sort,
      created_at,
      updated_at
    ) VALUES (
      admin_role_id,
      'admin',
      'Admin',
      'Administrator with most permissions',
      'active',
      2,
      NOW(),
      NOW()
    );
    RAISE NOTICE 'Created admin role (ID: %)', admin_role_id;
  ELSE
    RAISE NOTICE 'Found admin role (ID: %)', admin_role_id;
  END IF;
  
  -- 第五步：为第一个用户设置 admin 角色
  -- 先检查是否已有 admin 角色
  SELECT id INTO user_role_id
  FROM "user_role"
  WHERE user_id = user1_id AND role_id = admin_role_id;
  
  IF user_role_id IS NULL THEN
    -- 如果没有，则添加
    user_role_id := gen_random_uuid()::TEXT;
    INSERT INTO "user_role" (
      id,
      user_id,
      role_id,
      created_at,
      updated_at,
      expires_at
    ) VALUES (
      user_role_id,
      user1_id,
      admin_role_id,
      NOW(),
      NOW(),
      NULL -- Never expires
    );
    RAISE NOTICE 'Assigned admin role to user 1 (%)', user1_email;
  ELSE
    RAISE NOTICE 'User 1 (%) already has admin role', user1_email;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Operation completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User 1: % - Granted % credits, Set as admin', user1_email, credits_amount;
  RAISE NOTICE 'User 2: % - Granted % credits', user2_email, credits_amount;
  RAISE NOTICE '========================================';
  
END $$;

-- 第六步：验证结果
SELECT 
  u.email,
  u.id as user_id,
  COALESCE(SUM(c.remaining_credits), 0) as total_credits,
  CASE 
    WHEN ur.id IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as is_admin
FROM "user" u
LEFT JOIN "credit" c ON c.user_id = u.id 
  AND c.transaction_type = 'grant' 
  AND c.status = 'active'
  AND (c.expires_at IS NULL OR c.expires_at > NOW())
LEFT JOIN "user_role" ur ON ur.user_id = u.id
LEFT JOIN "role" r ON r.id = ur.role_id AND r.name = 'admin' AND r.status = 'active'
WHERE u.email IN ('xiongjp_fr@163.com', 'xiongjp_fr@hotmail.com')
GROUP BY u.email, u.id, ur.id
ORDER BY u.email;

-- ============================================
-- 注意事项：
-- 1. 积分永不过期（expires_at = NULL）
-- 2. 管理员角色永不过期（expires_at = NULL）
-- 3. 如果用户不存在，脚本会报错
-- 4. 如果用户已有 admin 角色，不会重复添加
-- ============================================

