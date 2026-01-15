# Vercel Runtime Logs 检查指南

## 📋 如何查看 Vercel Runtime Logs

### 方法 1: Vercel Dashboard

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目（subtitleTK）
3. 点击左侧菜单的 **"Deployments"**
4. 选择最新的部署
5. 点击 **"Functions"** 标签
6. 找到相关的 API 路由（如 `/api/auth/[...all]`）
7. 点击查看 **"Logs"**

### 方法 2: Vercel CLI

```bash
# 安装 Vercel CLI（如果还没有）
npm i -g vercel

# 登录
vercel login

# 查看实时日志
vercel logs --follow

# 查看特定函数的日志
vercel logs --follow --function api/auth/[...all]
```

## 🔍 需要查找的错误信息

### 1. 数据库连接错误

查找以下关键词：
- `DATABASE_URL is not set`
- `Connection refused`
- `ECONNREFUSED`
- `timeout`
- `SSL connection`

**示例错误**：
```
Error: DATABASE_URL is not set
  at db (src/core/db/index.ts:67:11)
```

### 2. 表不存在错误

查找以下关键词：
- `relation "session" does not exist`
- `relation "user" does not exist`
- `table does not exist`

**示例错误**：
```
error: relation "session" does not exist
  at executeQuery (drizzle-orm/...)
```

### 3. 权限错误（RLS）

查找以下关键词：
- `permission denied`
- `row-level security`
- `policy violation`
- `insufficient privileges`

**示例错误**：
```
error: new row violates row-level security policy for table "session"
```

### 4. 字段不匹配错误

查找以下关键词：
- `column "xxx" does not exist`
- `column "xxx" is of type`
- `type mismatch`

**示例错误**：
```
error: column "expiresAt" does not exist
  Hint: Perhaps you meant to reference the column "expires_at".
```

### 5. Better-Auth 相关错误

查找以下关键词：
- `drizzleAdapter`
- `better-auth`
- `session creation failed`
- `INVALID_EMAIL_OR_PASSWORD`

**示例错误**：
```
Error: Failed to create session
  at drizzleAdapter.createSession (...)
```

## 📝 日志检查清单

运行登录测试后，检查日志中是否有：

- [ ] 数据库连接成功消息
- [ ] Session 创建尝试的日志
- [ ] 任何 SQL 错误
- [ ] 任何权限错误
- [ ] 任何表/字段不存在的错误

## 🔧 常见错误和解决方案

### 错误 1: "relation 'session' does not exist"

**原因**: 表未创建

**解决**:
```bash
# 在本地运行
DATABASE_URL="你的Supabase连接" pnpm db:push
```

### 错误 2: "new row violates row-level security policy"

**原因**: RLS 阻止写入

**解决**: 运行 `scripts/fix-supabase-rls.sql` 禁用 RLS

### 错误 3: "column 'expiresAt' does not exist"

**原因**: 字段名不匹配（驼峰 vs 蛇形）

**解决**: 检查 schema 定义，确保使用正确的字段名

### 错误 4: "DATABASE_URL is not set"

**原因**: 环境变量未正确设置

**解决**: 在 Vercel Dashboard 中检查环境变量

## 📸 如何分享日志

如果需要帮助，请提供：

1. **错误堆栈**：完整的错误信息（包括堆栈跟踪）
2. **相关日志行**：错误发生前后的几行日志
3. **时间戳**：错误发生的时间
4. **请求信息**：触发错误的 API 端点和方法

## 🚀 快速检查命令

在本地运行以下命令来模拟生产环境：

```bash
# 使用生产环境的 DATABASE_URL 测试
DATABASE_URL="你的Supabase连接" pnpm test:vercel-auth
```

如果本地测试成功但生产环境失败，问题可能是：
- Vercel 环境变量配置错误
- Vercel 函数超时
- 网络连接问题





