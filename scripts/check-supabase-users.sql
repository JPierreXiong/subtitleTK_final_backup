-- ============================================
-- Supabase 用户数据检查 SQL 脚本
-- ============================================
-- 用途：在 Supabase SQL Editor 中运行此脚本，检查用户数据
-- 使用方法：复制到 Supabase Dashboard -> SQL Editor -> 运行
-- ============================================

-- 1. 检查用户表是否存在
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user'
ORDER BY ordinal_position;

-- 2. 检查所有用户（显示前20个）
SELECT 
  id,
  email,
  name,
  email_verified,
  plan_type,
  created_at,
  updated_at
FROM "user"
ORDER BY created_at DESC
LIMIT 20;

-- 3. 检查用户总数
SELECT COUNT(*) as total_users FROM "user";

-- 4. 检查特定邮箱的用户（替换为你的测试邮箱）
-- SELECT * FROM "user" WHERE email = 'your-test-email@example.com';

-- 5. 检查认证相关表
-- Session 表
SELECT COUNT(*) as session_count FROM session;

-- Account 表
SELECT COUNT(*) as account_count FROM account;

-- Verification 表
SELECT COUNT(*) as verification_count FROM verification;

-- 6. 检查最近的用户注册（最近24小时）
SELECT 
  id,
  email,
  name,
  email_verified,
  created_at
FROM "user"
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 7. 检查 Row Level Security (RLS) 状态
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification');

-- 8. 检查表权限
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('user', 'session', 'account', 'verification')
ORDER BY table_name, grantee;



