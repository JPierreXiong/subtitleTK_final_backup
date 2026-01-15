# 任务卡死预防和修复指南

## 问题描述
前端卡在 10%（"Fetching metadata & media"）通常是后端在写入任务时被 Supabase 的 RLS 策略拦截，导致请求挂起超时。

## 已实施的修复措施

### 1. 代码层面的超时保护 ✅

#### `src/app/api/media/status/route.ts`
- ✅ 添加了 `getUserInfo()` 超时保护（5秒）
- ✅ 添加了 `findMediaTaskById()` 超时保护（5秒）
- ✅ 增强了错误日志，包含堆栈信息，便于在 Vercel Logs 中定位问题

#### `src/app/api/media/submit/route.ts`
- ✅ 已有 4 分钟 API 调用超时保护
- ✅ 所有失败路径都会正确设置 `status: 'failed'` 和 `creditId`
- ✅ 确保退款逻辑能够正确触发

### 2. 积分退款机制 ✅

#### 自动退款逻辑
- ✅ `updateMediaTaskById()` 函数在任务状态变为 `failed` 时自动退款
- ✅ 即使没有传入 `creditId`，也会从数据库中查找
- ✅ 退款逻辑在数据库事务中执行，确保数据一致性

#### 退款触发条件
1. 任务处理失败（`processMediaTask` catch 块）
2. 后台任务失败（`processMediaTask().catch()` 块）
3. 手动重置任务（通过 SQL 脚本）

### 3. 数据库权限修复

#### SQL 脚本：`scripts/fix-supabase-rls-and-reset-tasks.sql`
在 Supabase SQL Editor 中运行此脚本：

```sql
-- 禁用 RLS（解决权限问题导致的挂死）
ALTER TABLE "session" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "media_tasks" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "credit" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "video_cache" DISABLE ROW LEVEL SECURITY;

-- 重置所有卡在 processing 状态的任务（触发自动退款）
UPDATE "media_tasks"
SET 
  status = 'failed',
  error_message = 'System Reset - Task was stuck in processing state',
  updated_at = NOW()
WHERE status = 'processing';
```

## 使用步骤

### 第一步：运行 SQL 脚本修复权限
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 运行 `scripts/fix-supabase-rls-and-reset-tasks.sql` 中的 SQL 命令

### 第二步：重新部署代码
1. 在 Vercel Dashboard 中点击 **Redeploy**
2. **取消勾选 Build Cache**（确保使用最新代码）
3. 等待部署完成

### 第三步：重新登录
1. 在网站上 **Sign out**
2. 重新 **Sign in**
3. 检查 Supabase 的 `session` 表是否有新记录

### 第四步：测试
1. 提交一个新的媒体任务
2. 观察是否还会卡在 10%
3. 如果任务失败，检查积分是否自动退款

## 预防措施

### 1. 超时保护
- ✅ API 调用超时：4 分钟
- ✅ 认证查询超时：5 秒
- ✅ 数据库查询超时：5 秒

### 2. 错误处理
- ✅ 所有错误都有详细的日志记录
- ✅ 错误信息包含堆栈跟踪，便于调试
- ✅ 所有失败路径都会触发退款

### 3. 监控建议
- 定期检查 Vercel Logs 中的超时错误
- 监控 `media_tasks` 表中 `processing` 状态的任务数量
- 如果发现卡死任务，运行 `scripts/reset-stuck-tasks.ts`

## 验证退款是否成功

### 方法 1：检查数据库
```sql
-- 检查失败的任务
SELECT id, status, error_message, credit_id 
FROM media_tasks 
WHERE status = 'failed' 
ORDER BY updated_at DESC 
LIMIT 10;

-- 检查积分记录状态（DELETED 表示已退款）
SELECT id, status, consumed_detail 
FROM credit 
WHERE id IN (
  SELECT credit_id FROM media_tasks WHERE status = 'failed'
) 
ORDER BY updated_at DESC;
```

### 方法 2：使用脚本
```bash
# 检查卡死的任务
pnpm check:stuck-tasks

# 重置卡死的任务（会自动退款）
pnpm reset:stuck-tasks

# 手动退款失败的任务
npx tsx scripts/refund-failed-tasks-direct.ts <userId>
```

## 注意事项

1. **RLS 安全**：禁用 RLS 后，所有用户都可以访问所有数据。如果需要在生产环境启用 RLS，请先配置正确的策略。

2. **免费试用**：免费试用任务不会消耗积分，因此不需要退款。

3. **事务一致性**：退款逻辑在数据库事务中执行，确保数据一致性。

4. **日志监控**：定期检查 Vercel Logs，查找 `[API_STATUS_ERROR]` 和 `[Media Task Processing Failed]` 日志。

## 相关文件

- `src/app/api/media/status/route.ts` - 状态查询 API（已添加超时保护）
- `src/app/api/media/submit/route.ts` - 任务提交 API（已有超时和退款逻辑）
- `src/shared/models/media_task.ts` - 任务模型（包含退款逻辑）
- `scripts/fix-supabase-rls-and-reset-tasks.sql` - SQL 修复脚本
- `scripts/reset-stuck-tasks.ts` - 重置卡死任务的脚本




