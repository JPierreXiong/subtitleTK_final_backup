-- ============================================
-- 修复 Supabase RLS 权限并重置卡死任务
-- ============================================
-- 使用方法：在 Supabase Dashboard → SQL Editor 中运行此脚本
-- 
-- 此脚本将：
-- 1. 禁用核心表的 RLS（解决权限问题导致的挂死）
-- 2. 重置所有卡在 processing 状态的任务为 failed（触发自动退款）
-- ============================================

-- 第一步：禁用 RLS（解决权限问题）
-- 这将允许应用正常读写数据，避免因权限问题导致请求挂起
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "media_tasks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "credit" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "video_cache" DISABLE ROW LEVEL SECURITY;

-- 第二步：重置所有卡在 processing 状态的任务
-- 这将触发自动退款逻辑（在 updateMediaTaskById 中实现）
UPDATE "media_tasks"
SET 
  status = 'failed',
  error_message = 'System Reset - Task was stuck in processing state',
  updated_at = NOW()
WHERE status = 'processing';

-- 第三步：显示重置结果
SELECT 
  COUNT(*) as reset_tasks_count,
  'Tasks reset to failed status' as message
FROM "media_tasks"
WHERE status = 'failed' 
  AND error_message = 'System Reset - Task was stuck in processing state';

-- 第四步：验证 RLS 状态
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('session', 'user', 'media_tasks', 'credit', 'video_cache')
ORDER BY tablename;

-- ============================================
-- 注意事项：
-- 1. 禁用 RLS 后，所有用户都可以访问所有数据
-- 2. 如果需要在生产环境启用 RLS，请先配置正确的策略
-- 3. 重置的任务会自动触发退款（通过 updateMediaTaskById 函数）
-- 4. 建议在修复后重新登录，确保 Session 表有数据
-- ============================================

