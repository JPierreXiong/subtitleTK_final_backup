-- ============================================
-- Supabase RLS 修复脚本
-- ============================================
-- 用途：禁用 RLS 或配置允许服务端访问的策略
-- 使用方法：复制到 Supabase Dashboard -> SQL Editor -> 运行
-- ============================================
-- ⚠️ 警告：禁用 RLS 会降低安全性，仅建议在开发/测试阶段使用
-- 生产环境应该配置合适的 RLS 策略而不是完全禁用
-- ============================================

-- ============================================
-- 方案 1: 临时禁用 RLS（快速修复，仅用于测试）
-- ============================================
-- 如果这是生产环境，建议使用方案 2 配置策略

-- 禁用所有认证相关表的 RLS
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "account" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" DISABLE ROW LEVEL SECURITY;

-- 验证 RLS 状态
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification')
ORDER BY tablename;

-- ============================================
-- 方案 2: 配置 RLS 策略（生产环境推荐）
-- ============================================
-- 如果使用方案 1，可以跳过这部分
-- 如果要在生产环境使用，请使用方案 2

-- 首先启用 RLS
-- ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
-- DROP POLICY IF EXISTS "Service role can do everything" ON "user";
-- DROP POLICY IF EXISTS "Service role can do everything" ON "session";
-- DROP POLICY IF EXISTS "Service role can do everything" ON "account";
-- DROP POLICY IF EXISTS "Service role can do everything" ON "verification";

-- 创建允许服务端（service_role）完全访问的策略
-- CREATE POLICY "Service role can do everything" ON "user" 
--   FOR ALL
--   USING (true) 
--   WITH CHECK (true);

-- CREATE POLICY "Service role can do everything" ON "session" 
--   FOR ALL
--   USING (true) 
--   WITH CHECK (true);

-- CREATE POLICY "Service role can do everything" ON "account" 
--   FOR ALL
--   USING (true) 
--   WITH CHECK (true);

-- CREATE POLICY "Service role can do everything" ON "verification" 
--   FOR ALL
--   USING (true) 
--   WITH CHECK (true);

-- ============================================
-- 检查 session 表索引（优化性能）
-- ============================================

-- 检查现有索引
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'session'
ORDER BY indexname;

-- 创建必要的索引（如果不存在）
CREATE INDEX IF NOT EXISTS "idx_session_user_id" ON "session" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session" ("token");
CREATE INDEX IF NOT EXISTS "idx_session_expires_at" ON "session" ("expires_at");

-- ============================================
-- 验证表结构（确保字段正确）
-- ============================================

-- 检查 session 表结构
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'session'
ORDER BY ordinal_position;

-- 检查外键约束
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
  AND tc.table_name = 'session';

-- ============================================
-- 测试写入权限（验证修复是否成功）
-- ============================================

-- 尝试插入一条测试 session（会立即删除）
-- 如果这个查询成功，说明写入权限正常
DO $$
DECLARE
  test_user_id TEXT;
  test_session_id TEXT;
BEGIN
  -- 获取一个存在的用户 ID
  SELECT id INTO test_user_id FROM "user" LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE '没有找到用户，跳过测试';
    RETURN;
  END IF;
  
  -- 创建测试 session
  test_session_id := 'test-' || gen_random_uuid()::TEXT;
  
  INSERT INTO "session" (
    id,
    user_id,
    token,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    test_session_id,
    test_user_id,
    'test-token-' || test_session_id,
    NOW() + INTERVAL '1 day',
    NOW(),
    NOW()
  );
  
  -- 立即删除测试数据
  DELETE FROM "session" WHERE id = test_session_id;
  
  RAISE NOTICE '✅ Session 表写入测试成功！';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Session 表写入测试失败: %', SQLERRM;
END $$;

-- ============================================
-- 完成
-- ============================================
-- 运行此脚本后，请：
-- 1. 检查上面的验证查询结果
-- 2. 在 Vercel 中重新部署
-- 3. 尝试登录并检查 session 表是否有新记录

