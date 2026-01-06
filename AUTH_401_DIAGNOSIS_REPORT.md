# 401 认证错误诊断报告

## 📊 诊断执行时间
2026-01-06

## 🔍 诊断结果摘要

### ✅ 正常项
1. **本地数据库连接**: ✅ 正常
   - DATABASE_URL 已正确配置（Supabase Pooler）
   - DATABASE_PROVIDER 设置为 `postgresql`
   - AUTH_SECRET 已设置

2. **数据库表结构**: ✅ 正常
   - `user` 表存在，有 1 条记录
   - `account` 表存在，有 1 条记录
   - `session` 表存在（结构正确）
   - `verification` 表存在（结构正确）

### ⚠️ 发现的问题

1. **Session 表为空** ⚠️
   - **状态**: Session 表存在但 0 条记录
   - **影响**: 可能导致登录后无法保持会话，触发 401 错误
   - **可能原因**:
     - Better-Auth 创建 session 时失败
     - RLS 策略阻止了 session 写入
     - Cookie 处理问题导致 session 无法保存

2. **Vercel 环境变量未验证** ⚠️
   - **状态**: 需要手动检查 Vercel Dashboard
   - **影响**: 如果环境变量配置错误，会导致连接错误的数据库
   - **检查项**:
     - `DATABASE_URL` 是否指向 Supabase（不是 Neon）
     - `DATABASE_PROVIDER` 是否为 `postgresql`
     - `AUTH_SECRET` 是否与本地一致
     - 是否还有旧的 Neon 相关变量

3. **RLS 策略未检查** ⚠️
   - **状态**: 需要检查 Supabase 中的 Row Level Security 设置
   - **影响**: 如果 RLS 启用且策略不正确，会阻止服务端访问表
   - **检查项**: 运行 `scripts/check-supabase-auth-tables.sql`

## 🔧 问题根源分析

### 核心矛盾点

根据代码分析，认证系统**完全依赖 `DATABASE_URL`**，不使用 `AUTH_DATABASE_URL`：

```typescript
// src/core/auth/config.ts:39
database: envConfigs.database_url
  ? drizzleAdapter(db(), {
      provider: getDatabaseProvider(envConfigs.database_provider),
      schema: schema,
    })
  : null,
```

**这意味着**：
- ✅ 如果 `DATABASE_URL` 指向 Supabase，认证会使用 Supabase
- ❌ 如果 `DATABASE_URL` 仍然指向 Neon，认证会使用 Neon
- ❌ 如果同时存在 `AUTH_DATABASE_URL`，代码会忽略它

### 表名大小写问题

PostgreSQL 中 `user` 是系统保留字，必须使用双引号：

```sql
-- ✅ 正确
SELECT * FROM "user";

-- ❌ 错误（会被解释为系统表）
SELECT * FROM user;
```

Drizzle ORM 应该自动处理这个问题，但需要确认。

### Better-Auth Session 创建流程

Better-Auth 的认证流程：
1. Sign Up/Sign In → 创建/验证用户
2. 创建 Session → 写入 `session` 表
3. 设置 Cookie → 返回 `better-auth.session_token`
4. 后续请求 → 从 Cookie 读取 token，查询 `session` 表

**如果 Session 表为空，说明步骤 2 失败**。

## 📋 必须执行的检查

### 1. Supabase SQL Editor 检查

运行 `scripts/check-supabase-auth-tables.sql`，重点关注：

```sql
-- 检查 RLS 是否启用
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification');

-- 检查 RLS 策略
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('user', 'session', 'account', 'verification');
```

**如果 RLS 启用且没有合适的策略，需要**：
- 临时禁用 RLS（仅用于测试）：
  ```sql
  ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE session DISABLE ROW LEVEL SECURITY;
  ALTER TABLE account DISABLE ROW LEVEL SECURITY;
  ALTER TABLE verification DISABLE ROW LEVEL SECURITY;
  ```
- 或配置允许服务端访问的策略

### 2. Vercel 环境变量检查

参考 `scripts/check-vercel-env.md`，检查：

1. **DATABASE_URL**
   - ✅ 必须是 Supabase Pooler 地址
   - ✅ 格式：`postgres://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true`
   - ❌ 不能是 Neon 地址

2. **DATABASE_PROVIDER**
   - ✅ 必须是 `postgresql`（不是 `postgres`）

3. **AUTH_SECRET**
   - ✅ 必须与本地 `.env.local` 一致

4. **需要删除的变量**
   - ❌ `AUTH_DATABASE_URL`（如果存在）
   - ❌ `POSTGRES_URL`（如果指向 Neon）
   - ❌ 其他 Neon 相关变量

### 3. 重新部署 Vercel

**重要**：修改环境变量后，必须重新部署：

1. 在 Vercel Dashboard 中点击 "Redeploy"
2. ⚠️ **取消勾选** "Use existing Build Cache"
3. 点击 "Redeploy"
4. 等待部署完成

## 🚀 修复步骤

### 步骤 1: 检查 Supabase RLS

1. 登录 Supabase Dashboard
2. 打开 SQL Editor
3. 运行 `scripts/check-supabase-auth-tables.sql`
4. 检查 RLS 状态和策略
5. 如果 RLS 阻止访问，临时禁用或配置策略

### 步骤 2: 检查 Vercel 环境变量

1. 登录 Vercel Dashboard
2. 进入项目 Settings -> Environment Variables
3. 检查所有变量（参考 `scripts/check-vercel-env.md`）
4. 删除不需要的变量
5. 确保 `DATABASE_URL` 指向 Supabase

### 步骤 3: 重新部署

1. 在 Vercel Dashboard 中点击 "Redeploy"
2. 取消勾选 "Use existing Build Cache"
3. 等待部署完成

### 步骤 4: 验证修复

1. 运行 `pnpm test:vercel-auth` 测试认证功能
2. 在浏览器中手动测试注册和登录
3. 检查 Supabase 中的 `session` 表是否有新记录

## 📝 测试结果

### 当前测试结果（`pnpm test:vercel-auth`）

- ✅ **Sign Up**: 成功（用户创建成功）
- ❌ **Sign In**: 失败（401: INVALID_EMAIL_OR_PASSWORD）
- ❌ **Get Session**: 失败（返回 null）
- ❌ **Sign Out**: 失败（需要有效 session）
- ✅ **错误密码测试**: 通过（正确拒绝）

### 分析

1. **Sign Up 成功但 Sign In 失败**：
   - 可能原因：密码加密/验证问题
   - 或：注册后数据库同步延迟

2. **Session 获取失败**：
   - 可能原因：Cookie 格式问题
   - 或：Session 表写入失败（RLS 阻止）

## 🎯 下一步行动

1. **立即执行**：
   - [ ] 在 Supabase SQL Editor 中运行 `check-supabase-auth-tables.sql`
   - [ ] 检查 Vercel 环境变量（参考 `check-vercel-env.md`）
   - [ ] 如果 RLS 启用，临时禁用或配置策略

2. **修复后验证**：
   - [ ] 重新部署 Vercel
   - [ ] 运行 `pnpm test:vercel-auth`
   - [ ] 在浏览器中手动测试

3. **如果问题仍然存在**：
   - [ ] 检查 Vercel 函数日志
   - [ ] 检查 Supabase 日志
   - [ ] 提供完整的错误堆栈（特别是 `drizzleAdapter` 相关）

## 📞 需要的信息

如果问题仍然存在，请提供：

1. **Supabase SQL 查询结果**：
   - RLS 状态
   - RLS 策略
   - 表权限

2. **Vercel 环境变量截图**：
   - 隐藏敏感信息（密码）
   - 显示变量名称和值的前几个字符

3. **错误日志**：
   - Vercel 函数日志
   - 浏览器控制台错误
   - `pnpm test:vercel-auth` 的完整输出

4. **诊断脚本输出**：
   - `pnpm diagnose:auth` 的完整输出
   - 特别是关于 `drizzleAdapter` 的错误



