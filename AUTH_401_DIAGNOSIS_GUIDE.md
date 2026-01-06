# 401 认证错误诊断指南

## 🔍 问题概述

在从 Neon 迁移到 Supabase 后，登录时遇到 **401 (Unauthorized)** 错误。

## 📋 诊断步骤

### 步骤 1: 运行本地诊断脚本

在项目根目录运行：

```bash
pnpm diagnose:auth
```

这个脚本会检查：
- ✅ 环境变量配置（DATABASE_URL, DATABASE_PROVIDER, AUTH_SECRET）
- ✅ 数据库连接状态
- ✅ 用户表数据
- ✅ 认证相关表（session, account, verification）

### 步骤 2: 在 Supabase 中检查用户数据

1. 登录 [Supabase Dashboard](https://supabase.com/)
2. 进入你的项目
3. 打开 **SQL Editor**
4. 运行 `scripts/check-supabase-users.sql` 中的查询

**关键查询**：检查你的测试邮箱是否存在于数据库中

```sql
SELECT * FROM "user" WHERE email = '你的测试邮箱@example.com';
```

### 步骤 3: 检查 Vercel 环境变量

在 Vercel Dashboard 中确认以下变量：

#### 必需的环境变量

```
DATABASE_URL=postgres://postgres.xxx:xxx@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_PROVIDER=postgresql
AUTH_SECRET=你的认证密钥
AUTH_URL=https://你的域名.com
NEXT_PUBLIC_APP_URL=https://你的域名.com
```

#### 重要检查点

1. **DATABASE_URL 格式**：
   - ✅ 使用 Pooler 连接（端口 6543）
   - ✅ 包含 `?pgbouncer=true`
   - ✅ 包含 `sslmode=require`

2. **DATABASE_PROVIDER**：
   - ✅ 必须设置为 `postgresql`（不是 `postgres`）

3. **AUTH_SECRET**：
   - ✅ 必须与本地 `.env.local` 中的值一致
   - ✅ 生成方式：`openssl rand -base64 32`

### 步骤 4: 检查数据库迁移状态

确保 Supabase 数据库已正确初始化：

```bash
# 检查数据库连接
pnpm db:test

# 如果表不存在，推送 schema
pnpm db:push
```

### 步骤 5: 检查 Vercel 部署状态

**重要**：修改环境变量后，必须重新部署！

1. 在 Vercel Dashboard 中点击 **Redeploy**
2. 选择 **"Use existing Build Cache"** 为 **No**
3. 等待部署完成

### 步骤 6: 检查 Supabase RLS (Row Level Security)

如果启用了 RLS，确保服务端可以访问用户表：

1. 在 Supabase Dashboard 中进入 **Authentication** -> **Policies**
2. 检查 `user` 表的策略
3. 确保有允许服务端访问的策略

**临时解决方案**（仅用于测试）：
```sql
-- 临时禁用 RLS（仅用于诊断）
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
```

## 🚨 常见原因和解决方案

### 原因 1: 用户数据在旧数据库中

**症状**：注册成功，但登录时 401

**原因**：注册时使用的是 Neon 数据库，登录时使用的是 Supabase 数据库

**解决方案**：
1. 在 Supabase 中重新注册一个新用户
2. 或者从 Neon 导出用户数据并导入到 Supabase

### 原因 2: 环境变量未生效

**症状**：本地正常，生产环境 401

**原因**：Vercel 环境变量未更新或未重新部署

**解决方案**：
1. 确认 Vercel 中的环境变量已更新
2. 执行 **Redeploy**（不使用缓存）
3. 清除浏览器缓存和 Cookie

### 原因 3: AUTH_SECRET 不匹配

**症状**：无法创建或验证 session

**原因**：本地和生产环境的 AUTH_SECRET 不一致

**解决方案**：
1. 确保 Vercel 中的 `AUTH_SECRET` 与本地 `.env.local` 一致
2. 如果不同，需要重新生成并更新所有环境

### 原因 4: 数据库表未创建

**症状**：诊断脚本显示"表不存在"

**原因**：Supabase 数据库未初始化

**解决方案**：
```bash
# 推送 schema 到 Supabase
pnpm db:push
```

### 原因 5: RLS 策略阻止访问

**症状**：用户存在，但查询失败

**原因**：Row Level Security 阻止了服务端访问

**解决方案**：
1. 检查 RLS 策略
2. 确保服务端角色（`service_role`）有访问权限
3. 或临时禁用 RLS 进行测试

## 🔧 快速修复流程

如果遇到 401 错误，按以下顺序检查：

1. ✅ **运行诊断脚本**：`pnpm diagnose:auth`
2. ✅ **检查 Supabase 用户表**：运行 SQL 查询
3. ✅ **验证 Vercel 环境变量**：确认所有变量正确
4. ✅ **重新部署 Vercel**：确保变量生效
5. ✅ **重新注册用户**：使用新邮箱注册测试
6. ✅ **检查 RLS 设置**：确保服务端可以访问

## 📝 代码分析

### 认证配置位置

- **认证配置**：`src/core/auth/config.ts`
- **数据库连接**：`src/core/db/index.ts`
- **认证路由**：`src/app/api/auth/[...all]/route.ts`
- **用户模型**：`src/shared/models/user.ts`

### 关键代码逻辑

1. **认证使用 `DATABASE_URL`**：
   ```typescript
   // src/core/auth/config.ts:39
   database: envConfigs.database_url
     ? drizzleAdapter(db(), {
         provider: getDatabaseProvider(envConfigs.database_provider),
         schema: schema,
       })
     : null,
   ```

2. **没有单独的 `AUTH_DATABASE_URL`**：
   - 所有认证操作都使用 `DATABASE_URL`
   - 确保 `DATABASE_URL` 指向正确的 Supabase 数据库

3. **用户表名**：
   - 表名是 `user`（小写），不是 `User`
   - 在 SQL 查询中需要使用双引号：`"user"`

## 🎯 下一步

如果诊断脚本显示一切正常，但仍然 401：

1. 检查浏览器控制台的网络请求
2. 查看 Vercel 函数日志
3. 检查 Supabase 日志
4. 尝试使用新的浏览器窗口（清除 Cookie）

## 📞 需要帮助？

如果问题仍然存在，请提供：

1. 诊断脚本的完整输出
2. Supabase SQL 查询结果
3. Vercel 环境变量截图（隐藏敏感信息）
4. 浏览器控制台的错误信息



