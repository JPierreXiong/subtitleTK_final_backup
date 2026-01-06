-- ============================================
-- Supabase 认证表结构检查 SQL 脚本
-- ============================================
-- 用途：检查认证相关表的结构、数据和 RLS 策略
-- 使用方法：复制到 Supabase Dashboard -> SQL Editor -> 运行
-- ============================================

-- 1. 检查所有认证相关表是否存在
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('user', 'session', 'account', 'verification')
ORDER BY table_name;

-- 2. 检查表名大小写（PostgreSQL 中 user 是保留字）
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification')
ORDER BY tablename;

-- 3. 检查 user 表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user'
ORDER BY ordinal_position;

-- 4. 检查 user 表数据
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
LIMIT 10;

-- 5. 检查 session 表数据
SELECT 
  id,
  user_id,
  token,
  expires_at,
  created_at
FROM session
ORDER BY created_at DESC
LIMIT 10;

-- 6. 检查 account 表数据
SELECT 
  id,
  user_id,
  provider_id,
  account_id,
  created_at
FROM account
ORDER BY created_at DESC
LIMIT 10;

-- 7. 检查 Row Level Security (RLS) 状态
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification')
ORDER BY tablename, policyname;

-- 8. 检查 RLS 是否启用
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification')
ORDER BY tablename;

-- 9. 检查表权限（确保 postgres 角色有访问权限）
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
  AND table_name IN ('user', 'session', 'account', 'verification')
  AND grantee IN ('postgres', 'authenticator', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 10. 检查外键约束
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('user', 'session', 'account', 'verification')
ORDER BY tc.table_name;

-- 11. 测试查询（检查是否可以正常读取数据）
-- 如果这个查询失败，说明有权限问题
SELECT COUNT(*) as user_count FROM "user";
SELECT COUNT(*) as session_count FROM session;
SELECT COUNT(*) as account_count FROM account;
SELECT COUNT(*) as verification_count FROM verification;

-- 12. 检查最近的用户注册（最近24小时）
SELECT 
  id,
  email,
  name,
  email_verified,
  created_at
FROM "user"
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

